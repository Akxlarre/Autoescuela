// supabase/functions/generate-epq-pdf/index.ts
//
// Edge Function: generate-epq-pdf
//
// Genera el cuestionario EPQ (Eysenck Personality Questionnaire, 81 preguntas Sí/No) en PDF
// on-demand — para que un pre-inscrito Clase Profesional que no respondió el test online lo
// rinda en papel en la sede. Reemplaza `buildEpqTestHtml` (HTML client-side, ver spec 0011-m).
// Nunca se almacena — mismo patrón que `generate-enrollment-sheet`.
//
// Invocación desde el frontend:
//   const { data, error } = await supabase.functions.invoke('generate-epq-pdf', {
//     body: { studentName?, rut?, licencia? }
//   })
//   // data es un Blob con el PDF
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { escapePdfWinAnsi as esc, assemblePdf, wrapLines } from '../_shared/pdf-utils.ts';
import { EPQ_QUESTIONS } from '../_shared/epq-questions.ts';

// ─── CORS ───────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const { studentName, rut, licencia } = body ?? {};

    const pdfBytes = buildEpqPdf({
      studentName: typeof studentName === 'string' ? studentName : null,
      rut: typeof rut === 'string' ? rut : null,
      licencia: typeof licencia === 'string' ? licencia : null,
    });

    const safeName = sanitize(`Test_EPQ_${studentName ?? 'en_blanco'}`);
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (err) {
    console.error('generate-epq-pdf error:', err);
    return jsonErr(err instanceof Error ? err.message : 'Internal server error', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PDF Builder
// ══════════════════════════════════════════════════════════════════════════════

interface EpqData {
  studentName: string | null;
  rut: string | null;
  licencia: string | null;
}

const W = 595;
const H = 842;
const M = 50;
const TOP = H - 50;
const BOTTOM = 60;

function buildEpqPdf(data: EpqData): Uint8Array {
  const pages: string[] = [];
  let ops: string[] = [];
  let y = TOP;

  const text = (x: number, yPos: number, str: string, size: number, bold = false) => {
    const font = bold ? 'F2' : 'F1';
    ops.push(`BT /${font} ${size} Tf ${x} ${yPos} Td (${esc(str)}) Tj ET`);
  };
  const box = (x: number, yPos: number) => ops.push(`${x} ${yPos} 8 8 re S`);
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);

  const newPage = () => {
    pages.push(ops.join('\n'));
    ops = [];
    y = TOP;
  };

  // ── Header (solo primera página) ──────────────────────────────────────────
  text(M, y, 'Test Psicológico EPQ', 16, true);
  y -= 14;
  text(M, y, 'Cuestionario de personalidad de Eysenck — 81 preguntas', 9);
  y -= 20;

  text(M, y, `Nombre: ${data.studentName ?? '_____________________________'}`, 9);
  y -= 14;
  text(M, y, `RUT: ${data.rut ?? '______________'}`, 9);
  text(M + 200, y, `Clase: ${data.licencia ?? '______'}`, 9);
  y -= 18;

  const instructions = wrapLines(
    'Marque con una X la casilla Sí o No en cada pregunta, según su forma de ser. ' +
      'No hay respuestas correctas ni incorrectas. Responda todas las preguntas.',
    110,
  );
  for (const l of instructions) {
    text(M, y, l, 8);
    y -= 11;
  }
  y -= 8;
  line(M, y, W - M, y);
  y -= 16;

  // ── Preguntas ────────────────────────────────────────────────────────────
  // Fuente 9pt (antes 8pt) e interlineado/padding generosos: un cuestionario que se
  // responde a mano en papel necesita legibilidad, no compresión — más páginas está bien.
  const QUESTION_SIZE = 9;
  const LINE_HEIGHT = 13;
  // El offset del separador se mide desde la BASELINE del texto, no desde el borde de la
  // celda — un ascendente a 9pt (ej. "¿", "d", "l") sube ~6.5pt sobre su propia baseline, así
  // que un offset de "8pt libres" en realidad solo deja 8-6.5=1.5pt de aire real (bug de la
  // primera corrección: se ignoró la altura del glifo). GAP_BELOW_LINE ya resta esa altura.
  const ASCENDER_HEIGHT = 6.5;
  const GAP_BELOW_LINE = ASCENDER_HEIGHT + 7; // aire real entre la línea y el texto de abajo
  const GAP_ABOVE_LINE = 10; // aire entre la última línea de esta pregunta y la línea
  const ROW_PADDING = GAP_ABOVE_LINE + GAP_BELOW_LINE;

  EPQ_QUESTIONS.forEach((q, i) => {
    const qLines = wrapLines(q, 68);
    const rowH = qLines.length * LINE_HEIGHT + ROW_PADDING;

    if (y - rowH < BOTTOM) newPage();

    text(M, y, `${i + 1}.`, QUESTION_SIZE, true);
    qLines.forEach((l, li) => text(M + 22, y - li * LINE_HEIGHT, l, QUESTION_SIZE));
    box(W - M - 62, y - 2);
    text(W - M - 48, y, 'Sí', QUESTION_SIZE);
    box(W - M - 30, y - 2);
    text(W - M - 16, y, 'No', QUESTION_SIZE);

    // Línea separadora dibujada bajo el contenido de ESTA fila (antes de avanzar `y`), a
    // GAP_BELOW_LINE de la baseline de la fila siguiente — aire real, ya descontado el
    // ascendente del glifo más alto.
    line(M, y - rowH + GAP_BELOW_LINE, W - M, y - rowH + GAP_BELOW_LINE);
    y -= rowH;
  });

  newPage();
  return assemblePdf(pages, W, H);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sanitize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 80);
}

function jsonErr(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
