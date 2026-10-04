// supabase/functions/_shared/ficha-tecnica-pdf.ts
//
// Armado del informe "Ficha Técnica" (clases prácticas Clase B de un alumno). Sin dependencias de
// red ni de Supabase: recibe las clases ya mapeadas y devuelve los bytes del PDF, así se puede
// probar con `deno test` (fix-292-m). Lo usa generate-ficha-tecnica-pdf.
// @ts-nocheck

import { escapePdfWinAnsi as esc, assemblePdf, wrapLines } from './pdf-utils.ts';

export interface ClasePractica {
  numero: number;
  fecha: string | null;
  hora: string | null;
  instructor: string | null;
  kmInicio: number | null;
  kmFin: number | null;
  observaciones: string | null;
  /** La clase ya se realizó (`class_b_sessions.status = 'completed'`). */
  completada: boolean;
  ausente: boolean;
  cancelada: boolean;
  justificada: boolean;
  justificacion: string | null;
  alumnoFirmo: boolean;
  instructorFirmo: boolean;
}

/** A4 vertical, en puntos. */
export const FICHA_TECNICA_PAGE = { width: 595, height: 842, margin: 40 };

export const FICHA_TECNICA_COLUMNS = [
  { header: 'N°', width: 30 },
  { header: 'Fecha/Hora', width: 70 },
  { header: 'Instructor', width: 105 },
  { header: 'Kilometraje', width: 90 },
  { header: 'Observaciones', width: 165 },
  { header: 'Val.', width: 45 },
];

const W = FICHA_TECNICA_PAGE.width;
const H = FICHA_TECNICA_PAGE.height;
const M = FICHA_TECNICA_PAGE.margin;
const TOP = H - 50;
const BOTTOM = 60;

const PARTES_FECHA_HORA = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'America/Santiago',
});

/**
 * Día y hora de una clase en hora de Chile, como los muestra la pantalla: "18-08" y "16:40".
 * Se arma por partes y se rellena con ceros a mano: en `es-CL` el formato ignora "2-digit" para
 * día y mes (da "18/8") y `toLocaleTimeString` da "04:40 p. m." con un espacio que la fuente del
 * PDF no tiene (salía "p.?m.").
 */
export function fechaHoraClase(scheduledAt: Date): { fecha: string; hora: string } {
  const parts = Object.fromEntries(
    PARTES_FECHA_HORA.formatToParts(scheduledAt).map((p) => [p.type, p.value.padStart(2, '0')]),
  );
  return { fecha: `${parts.day}-${parts.month}`, hora: `${parts.hour}:${parts.minute}` };
}

function estadoTexto(c: ClasePractica): string {
  if (c.ausente) return c.justificada ? 'Inasist. justificada' : 'Inasistencia';
  if (c.cancelada) return 'Cancelada — pend. reagendar';
  return '';
}

/**
 * Texto de la columna Observaciones. "Pendiente de sesión" es solo para una clase que todavía no
 * ocurre: una completada, una inasistencia o una cancelada sin texto quedan en blanco.
 */
export function observacionesTexto(c: ClasePractica): string {
  if (c.observaciones || c.justificacion) return c.observaciones || c.justificacion || '';
  return c.completada || c.ausente || c.cancelada ? '' : 'Pendiente de sesión';
}

function kilometrajeTexto(c: ClasePractica): string {
  if (c.kmInicio === null) return '-';
  const fin = c.kmFin !== null ? c.kmFin.toLocaleString('es-CL') : '?';
  return `${c.kmInicio.toLocaleString('es-CL')} -> ${fin} km`;
}

export function buildFichaTecnicaPdf(
  clases: ClasePractica[],
  opts: { studentName: string; matricula: string },
): Uint8Array {
  const pages: string[] = [];
  let ops: string[] = [];
  let y = TOP;

  const text = (x: number, yPos: number, str: string, size: number, bold = false) => {
    const font = bold ? 'F2' : 'F1';
    ops.push(`BT /${font} ${size} Tf ${x} ${yPos} Td (${esc(str)}) Tj ET`);
  };
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  const rect = (x: number, yPos: number, w: number, h: number, fill = false) =>
    ops.push(`${x} ${yPos} ${w} ${h} re ${fill ? 'f' : 'S'}`);
  const setGray = (g: number) => ops.push(`${g} g ${g} G`);
  const resetColor = () => ops.push('0 g 0 G');

  const cols = FICHA_TECNICA_COLUMNS.map((c) => c.width);
  const headers = FICHA_TECNICA_COLUMNS.map((c) => c.header);
  const contentW = cols.reduce((a, b) => a + b, 0);

  const drawTableHeader = () => {
    setGray(0.88);
    rect(M, y - 14, contentW, 14, true);
    resetColor();
    let xCur = M;
    headers.forEach((h, i) => {
      text(xCur + 2, y - 10, h, 8, true);
      xCur += cols[i];
    });
    y -= 14;
    line(M, y, M + contentW, y);
  };

  const flushPage = () => {
    pages.push(ops.join('\n'));
    ops = [];
  };
  const startNewPage = () => {
    y = TOP;
    drawTableHeader();
  };

  // ── Header ───────────────────────────────────────────────────────────────
  text(M, y, 'Ficha Técnica — Clases Prácticas', 15, true);
  y -= 14;
  text(M, y, 'Desempeño en clases prácticas', 9);
  y -= 18;
  text(M, y, `Alumno: ${opts.studentName || '_____________________________'}`, 9);
  y -= 12;
  text(M, y, `Matrícula: ${opts.matricula}`, 9);
  y -= 16;

  drawTableHeader();

  // ── Filas ────────────────────────────────────────────────────────────────
  for (const c of clases) {
    const obsLines = wrapLines(observacionesTexto(c), 42);
    const estado = estadoTexto(c);
    const rowLines = Math.max(1, obsLines.length + (estado ? 1 : 0));
    const rowH = Math.max(22, rowLines * 10 + 6);

    if (y - rowH < BOTTOM) {
      flushPage();
      startNewPage();
    }

    let xCur = M;
    text(xCur + 2, y - 10, `#${c.numero}`, 8, true);
    xCur += cols[0];

    text(xCur + 2, y - 9, c.fecha ?? '-', 8);
    text(xCur + 2, y - 18, c.hora ?? '-', 7);
    xCur += cols[1];

    text(xCur + 2, y - 10, c.instructor ?? 'Sin asignar', 8);
    xCur += cols[2];

    text(xCur + 2, y - 10, kilometrajeTexto(c), 8);
    xCur += cols[3];

    let obsY = y - 9;
    if (estado) {
      text(xCur + 2, obsY, estado, 7, true);
      obsY -= 10;
    }
    obsLines.forEach((l) => {
      text(xCur + 2, obsY, l, 7);
      obsY -= 9;
    });
    xCur += cols[4];

    const validacion = `${c.alumnoFirmo ? '[X]' : '[ ]'}A ${c.instructorFirmo ? '[X]' : '[ ]'}I`;
    text(xCur + 2, y - 10, validacion, 7);

    y -= rowH;
    line(M, y, M + contentW, y);
  }

  flushPage();
  return assemblePdf(pages, W, H);
}
