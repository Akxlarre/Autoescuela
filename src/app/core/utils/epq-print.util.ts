/**
 * EPQ printable test — Functional Core
 *
 * Construye (función pura, sin efectos) un documento HTML imprimible del test
 * psicológico EPQ (81 preguntas Sí/No). Se usa cuando un pre-inscrito profesional
 * NO respondió el test online y debe rendirlo en papel en la sede.
 *
 * El efecto de abrir la ventana e imprimir vive en `EpqPrintService`.
 */
import { EPQ_QUESTIONS } from '@core/utils/epq-questions.const';

export interface EpqPrintOptions {
  /** Nombre completo del alumno (opcional — si falta, se deja una línea en blanco). */
  studentName?: string | null;
  /** RUT del alumno (opcional). */
  rut?: string | null;
  /** Clase de licencia solicitada (ej: "A2"). */
  licencia?: string | null;
}

/** Escapa caracteres especiales para evitar romper el HTML / inyección. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Campo del encabezado: valor escapado o línea en blanco para llenar a mano. */
function field(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  return v ? escapeHtml(v) : '<span class="blank"></span>';
}

/**
 * Devuelve el HTML completo (documento) del test EPQ listo para imprimir.
 * Pura: misma entrada → misma salida, sin tocar el DOM ni `window`.
 */
export function buildEpqTestHtml(opts: EpqPrintOptions = {}): string {
  const rows = EPQ_QUESTIONS.map(
    (q, i) => `
      <tr>
        <td class="num">${i + 1}.</td>
        <td class="q">${escapeHtml(q)}</td>
        <td class="opt"><span class="box"></span> Sí</td>
        <td class="opt"><span class="box"></span> No</td>
      </tr>`,
  ).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Test Psicológico EPQ</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; font-size: 12px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .subtitle { font-size: 12px; color: #444; margin: 0 0 16px; }
    .header { border: 1px solid #999; border-radius: 6px; padding: 12px 14px; margin-bottom: 16px; }
    .header .line { margin-bottom: 6px; }
    .header label { font-weight: bold; margin-right: 6px; }
    .blank { display: inline-block; min-width: 220px; border-bottom: 1px solid #333; height: 1em; }
    .instructions { font-size: 11px; color: #444; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 5px 6px; vertical-align: top; border-bottom: 1px solid #ddd; }
    td.num { width: 26px; text-align: right; color: #555; }
    td.q { width: auto; }
    td.opt { width: 52px; white-space: nowrap; text-align: center; }
    .box { display: inline-block; width: 12px; height: 12px; border: 1px solid #333; margin-right: 3px; vertical-align: middle; }
    @media print {
      @page { margin: 0 12mm; }
      body { margin: 0; padding-top: 10mm; }
      thead { display: table-header-group; }
      thead td { height: 10mm; border: none !important; }
      table { margin-bottom: 10mm; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Test Psicológico EPQ</h1>
  <p class="subtitle">Cuestionario de personalidad de Eysenck — 81 preguntas</p>

  <div class="header">
    <div class="line"><label>Nombre:</label> ${field(opts.studentName)}</div>
    <div class="line"><label>RUT:</label> ${field(opts.rut)}
      &nbsp;&nbsp;<label>Clase:</label> ${field(opts.licencia)}</div>
  </div>

  <p class="instructions">
    Marque con una X o un tick la casilla <strong>Sí</strong> o <strong>No</strong> en cada pregunta, según su
    forma de ser. No hay respuestas correctas ni incorrectas. Responda todas las preguntas.
  </p>

  <table>
    <thead><tr><td colspan="4"></td></tr></thead>
    <tbody>${rows}
    </tbody>
  </table>

</body>
</html>`;
}
