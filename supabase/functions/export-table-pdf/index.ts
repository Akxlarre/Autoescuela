// supabase/functions/export-table-pdf/index.ts
//
// Edge Function: export-table-pdf (spec 0021-m)
//
// Convierte en PDF una tabla que la pantalla ya tiene armada. No consulta la base de datos:
// quien llama envía las cabeceras y las celdas de las filas que el usuario está viendo, así el
// PDF no puede traer filas distintas a las de la pantalla (ver bug B1 de export-students, que
// vuelve a consultar y filtrar por su cuenta).
//
// Body esperado:
//   title         : string       — título del documento
//   subtitle      : string       — opcional; línea bajo el título
//   headers       : string[]     — cabeceras de columna (1 a 12)
//   rows          : string[][]   — celdas, en el orden de `headers` (hasta 5000 filas)
//   columnWeights : number[]     — opcional; ancho relativo de cada columna
//   footer        : string       — opcional; pie de página (ej. "Total: 12 egresados")
//
// Respuesta: application/pdf.
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildTablePdf } from '../_shared/table-pdf.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_COLUMNS = 12;
const MAX_ROWS = 5000;
const MAX_TEXT = 200;

function jsonError(msg: string, status = 500) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const text = (value: unknown): string => String(value ?? '').slice(0, MAX_TEXT);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonError('No autorizado', 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) return jsonError('No autorizado', 401);

    const body = await req.json();
    const headers = Array.isArray(body.headers) ? body.headers.map(text) : [];
    const rows = Array.isArray(body.rows) ? body.rows : null;

    if (headers.length === 0 || headers.length > MAX_COLUMNS) {
      return jsonError(`Se esperan entre 1 y ${MAX_COLUMNS} columnas`, 400);
    }
    if (!rows || rows.length > MAX_ROWS || rows.some((r: unknown) => !Array.isArray(r))) {
      return jsonError(`Se espera una lista de hasta ${MAX_ROWS} filas`, 400);
    }

    const fileBytes = await buildTablePdf({
      title: text(body.title) || 'Listado',
      subtitle: body.subtitle ? text(body.subtitle) : undefined,
      headers,
      rows: rows.map((r: unknown[]) => r.map(text)),
      columnWeights: Array.isArray(body.columnWeights) ? body.columnWeights.map(Number) : undefined,
      footer: body.footer ? text(body.footer) : undefined,
    });

    return new Response(fileBytes, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/pdf' },
    });
  } catch (err) {
    console.error('[export-table-pdf]', err);
    return jsonError('Error interno al generar el archivo');
  }
});
