// supabase/functions/_shared/class-book-calendar.ts
//
// Calendario de Clases del Libro: reparte la malla fija del libro real sobre las fechas activas
// del curso. Lo usan el PDF y la pantalla del Libro (fix-350-m), para que muestren lo mismo.
//
//   deno test supabase/functions/_shared/class-book-calendar.test.ts

/** Fila de la malla tal como viene del libro real. `fecha` es la del libro real 2022: solo
 *  sirve para saber qué filas son del mismo día, nunca se muestra. */
export interface CurriculumRow {
  fecha: string;
  asignatura: string;
  materias: string;
  horas: string;
  profesor: string;
}

/** Fila del calendario ya fechada. `fecha` es ISO (YYYY-MM-DD), o null si faltan sesiones. */
export interface CalendarRow {
  numero: number;
  fecha: string | null;
  asignatura: string;
  materias: string;
  horas: string;
  profesor: string;
}

export interface CalendarResult {
  rows: CalendarRow[];
  /** Días de clase de la malla. */
  blocks: number;
  /** Fechas activas (no canceladas) del curso. Si son menos que `blocks`, hay filas sin fecha. */
  activeDates: number;
}

/**
 * Agrupa filas consecutivas que comparten la misma `fecha` del libro real en un "bloque de
 * sesión": un día de clase, que puede traer 1-4 filas de materias distintas. Las filas LIBRE se
 * descartan: los días sin clase los decide `professional_theory_sessions`, no el libro 2022.
 */
export function groupIntoSessionBlocks(rows: CurriculumRow[]): CurriculumRow[][] {
  const blocks: CurriculumRow[][] = [];
  let current: CurriculumRow[] = [];
  let currentFecha: string | null = null;
  for (const r of rows) {
    if (r.asignatura === 'LIBRE') continue;
    if (r.fecha !== currentFecha) {
      if (current.length) blocks.push(current);
      current = [];
      currentFecha = r.fecha;
    }
    current.push(r);
  }
  if (current.length) blocks.push(current);
  return blocks;
}

/**
 * Asigna a cada bloque de la malla, en orden, la siguiente fecha activa del curso. Las sesiones
 * canceladas (feriados) no cuentan. Nunca inventa fechas: si faltan, la fila queda sin fecha.
 */
export function buildCalendarRows(
  curriculum: CurriculumRow[],
  sessions: { date: string; status: string }[],
): CalendarResult {
  const blocks = groupIntoSessionBlocks(curriculum);
  const activeDates = sessions
    .filter((s) => s.status !== 'cancelled')
    .map((s) => s.date)
    .sort();

  const rows: CalendarRow[] = [];
  blocks.forEach((block, bi) => {
    for (const row of block) {
      rows.push({
        numero: rows.length + 1,
        fecha: activeDates[bi] ?? null,
        asignatura: row.asignatura,
        materias: row.materias,
        horas: row.horas,
        profesor: row.profesor,
      });
    }
  });

  return { rows, blocks: blocks.length, activeDates: activeDates.length };
}
