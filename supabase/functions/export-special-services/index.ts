// supabase/functions/export-special-services/index.ts
//
// Edge Function: export-special-services
// Genera reporte de ventas en Excel o PDF.
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { escapePdfWinAnsi, textWidth, assemblePdf, wrapLines } from '../_shared/pdf-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { format, branch_id } = await req.json();

    let query = supabase
      .from('special_service_sales')
      .select('*, service_catalog(name), branches(name)')
      .order('sale_date', { ascending: false });

    if (branch_id) query = query.eq('branch_id', branch_id);

    const { data: sales, error } = await query;
    if (error) throw error;

    if (format === 'excel') {
      const headers = ['Cliente', 'RUT', 'Servicio', 'Monto', 'Estado', 'Pagado', 'Fecha', 'Sede'];
      const rows = sales.map((s) => [
        s.client_name ?? '',
        s.client_rut ?? '',
        s.service_catalog?.name ?? '',
        s.price,
        s.status === 'completed' ? 'Completado' : 'Pendiente',
        s.paid ? 'Sí' : 'No',
        s.sale_date ?? '',
        s.branches?.name ?? '',
      ]);
      return new Response(JSON.stringify({ headers, rows }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (format === 'pdf') {
      const W = 595,
        H = 842;
      const ML = 40,
        MR = 40,
        MT = 50,
        MB = 50;

      let ops = '';
      const pages: string[] = [];
      let y = H - MT;

      const T = (x: number, yp: number, text: string, f: 'F1' | 'F2', size: number) => {
        ops += `BT /${f} ${size} Tf ${x} ${Math.round(yp)} Td (${escapePdfWinAnsi(text)}) Tj ET\n`;
      };

      const HLINE = (yp: number, lw = 0.5, x1 = ML, x2 = W - MR) => {
        ops += `${lw} w ${x1} ${Math.round(yp)} m ${x2} ${Math.round(yp)} l S\n`;
      };

      const NP = () => {
        if (ops) pages.push(ops);
        ops = '';
        y = H - MT;
        T(ML, y, 'Reporte de Ventas - Servicios Especiales', 'F2', 14);
        y -= 25;
      };

      NP(); // Start first page without pushing empty string

      // Table Header
      const colX = [ML, 200, 320, 380, 440, 500];
      const headers = ['Cliente/RUT', 'Servicio', 'Monto', 'Estado', 'Cobro', 'Fecha'];

      T(colX[0], y, headers[0], 'F2', 9);
      T(colX[1], y, headers[1], 'F2', 9);
      T(colX[2], y, headers[2], 'F2', 9);
      T(colX[3], y, headers[3], 'F2', 9);
      T(colX[4], y, headers[4], 'F2', 9);
      T(colX[5], y, headers[5], 'F2', 9);
      y -= 5;
      HLINE(y);
      y -= 15;

      for (const s of sales) {
        if (y < MB + 30) NP();

        const name = s.client_name || '—';
        const rut = s.client_rut || '—';
        const service = s.service_catalog?.name || '—';
        const price = `$${s.price.toLocaleString('es-CL')}`;
        const status = s.status === 'completed' ? 'Compl.' : 'Pend.';
        const paid = s.paid ? 'Cobrado' : '—';
        const date = s.sale_date;

        T(colX[0], y, name.slice(0, 25), 'F1', 8);
        T(colX[1], y, service.slice(0, 20), 'F1', 8);
        T(colX[2], y, price, 'F1', 8);
        T(colX[3], y, status, 'F1', 8);
        T(colX[4], y, paid, 'F1', 8);
        T(colX[5], y, date, 'F1', 8);

        y -= 10;
        T(colX[0], y, rut, 'F1', 7);
        y -= 15;
        HLINE(y, 0.1);
        y -= 10;
      }

      pages.push(ops);
      const pdfBytes = assemblePdf(pages, W, H);
      return new Response(pdfBytes, {
        headers: { ...corsHeaders, 'Content-Type': 'application/pdf' },
      });
    }

    return new Response('Invalid format', { status: 400 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
