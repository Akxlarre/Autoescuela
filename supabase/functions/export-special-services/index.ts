// supabase/functions/export-special-services/index.ts
//
// Edge Function: export-special-services
// Exporta en Excel o PDF las ventas que muestra el Historial de ventas (fix-440-m).
//
// Body: { format: 'excel' | 'pdf', branch_id: number | null, sale_ids: number[] }
//   sale_ids — las ventas visibles en pantalla (filtro de servicio, período y búsqueda). Sin una
//              lista válida responde 400: ya no se exporta "todo" a ciegas (antes, fix-147-b).
//   branch_id — se valida con resolveBranchScope (fix-430-m): un id de otra sede no sale.
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { authErrorResponse, requireStaff, resolveBranchScope } from '../_shared/staff-auth.ts';
import { escapePdfWinAnsi, textWidth, assemblePdf } from '../_shared/pdf-utils.ts';
import { EXPORT_HEADERS, exportRows, parseSaleIds } from './rows.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // fix-043-i: solo staff. La anon key pasa verify_jwt, así que se exige usuario real + rol.
    const access = await requireStaff(req, ['admin', 'secretary']);
    if (!access.ok) return authErrorResponse(access, corsHeaders);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { format, branch_id: requestedBranch, sale_ids: rawIds } = await req.json();

    // fix-430-m: la sede la valida el servidor; una secretaria sin grant solo ve la suya.
    const scope = resolveBranchScope(access, requestedBranch);
    if (!scope.ok) return authErrorResponse(scope, corsHeaders);
    const branch_id = scope.branchId;

    const saleIds = parseSaleIds(rawIds);
    if (saleIds === null) return jsonResponse({ error: 'sale_ids (number[]) es requerido' }, 400);

    let sales = [];
    if (saleIds.length > 0) {
      let query = supabase
        .from('special_service_sales')
        .select(
          'sale_date, created_at, client_name, client_rut, service_name, document_number, payment_method, price, service_catalog(name), branches(name)',
        )
        .in('id', saleIds)
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (branch_id !== null) query = query.eq('branch_id', branch_id);

      const { data, error } = await query;
      if (error) throw error;
      sales = data ?? [];
    }

    const { rows, total } = exportRows(sales);

    if (format === 'excel') {
      const totalRow = ['Total', '', '', '', '', '', total, ''];
      return jsonResponse({ headers: [...EXPORT_HEADERS], rows: [...rows, totalRow] });
    }

    if (format === 'pdf') {
      const W = 595,
        H = 842;
      const ML = 40,
        MR = 40,
        MT = 50,
        MB = 50;
      const RIGHT = W - MR;

      let ops = '';
      const pages: string[] = [];
      let y = H - MT;

      const T = (x: number, yp: number, text: string, f: 'F1' | 'F2', size: number) => {
        ops += `BT /${f} ${size} Tf ${x} ${Math.round(yp)} Td (${escapePdfWinAnsi(text)}) Tj ET\n`;
      };
      /** Texto alineado a la derecha en `xRight`. */
      const TR = (xRight: number, yp: number, text: string, f: 'F1' | 'F2', size: number) => {
        T(xRight - textWidth(text, size, f === 'F2'), yp, text, f, size);
      };
      const HLINE = (yp: number, lw = 0.5, x1 = ML, x2 = RIGHT) => {
        ops += `${lw} w ${x1} ${Math.round(yp)} m ${x2} ${Math.round(yp)} l S\n`;
      };

      // Fecha | Cliente (RUT abajo) | Servicio (sede abajo) | N° boleta | Medio de pago | Monto
      const colX = [ML, 100, 255, 385, 445];
      const header = () => {
        T(colX[0], y, 'Fecha', 'F2', 8);
        T(colX[1], y, 'Cliente / RUT', 'F2', 8);
        T(colX[2], y, 'Servicio / Sede', 'F2', 8);
        T(colX[3], y, 'N° boleta', 'F2', 8);
        T(colX[4], y, 'Medio de pago', 'F2', 8);
        TR(RIGHT, y, 'Monto', 'F2', 8);
        y -= 5;
        HLINE(y);
        y -= 13;
      };
      const newPage = () => {
        if (ops) pages.push(ops);
        ops = '';
        y = H - MT;
        T(ML, y, 'Historial de Ventas - Servicios Especiales', 'F2', 14);
        y -= 25;
        header();
      };

      newPage();
      const formatCLP = (n: number) => `$${n.toLocaleString('es-CL')}`;

      for (const [fecha, cliente, rut, servicio, boleta, medio, monto, sede] of rows) {
        if (y < MB + 40) newPage();
        T(colX[0], y, String(fecha), 'F1', 8);
        T(colX[1], y, String(cliente).slice(0, 30), 'F1', 8);
        T(colX[2], y, String(servicio).slice(0, 26), 'F1', 8);
        T(colX[3], y, String(boleta) || '—', 'F1', 8);
        T(colX[4], y, String(medio) || '—', 'F1', 8);
        TR(RIGHT, y, formatCLP(Number(monto)), 'F1', 8);
        y -= 10;
        T(colX[1], y, String(rut), 'F1', 7);
        T(colX[2], y, String(sede).slice(0, 30), 'F1', 7);
        y -= 8;
        HLINE(y, 0.1);
        y -= 12;
      }

      if (y < MB + 30) newPage();
      HLINE(y + 6);
      T(colX[0], y - 6, `Total (${rows.length} ventas)`, 'F2', 9);
      TR(RIGHT, y - 6, formatCLP(total), 'F2', 9);

      pages.push(ops);
      const pdfBytes = assemblePdf(pages, W, H);
      return new Response(pdfBytes, {
        headers: { ...corsHeaders, 'Content-Type': 'application/pdf' },
      });
    }

    return new Response('Invalid format', { status: 400 });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
});
