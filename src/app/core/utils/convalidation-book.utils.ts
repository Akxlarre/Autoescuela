import type { CursoOption } from '@core/models/ui/sesion-profesional.model';
import type { ConvalidationLicense, LibroOption } from '@core/models/ui/libro-de-clases.model';
import { getModuleNames } from '@core/utils/professional-modules';

/**
 * Reglas de los Libros de Clases de convalidación (spec 0018-m).
 *
 * Un libro de convalidación NO es un `promotion_course` (opción B): se arma al vuelo desde su
 * curso madre. Todos los valores salen de los libros reales `libroclasesconva3.pdf` /
 * `libroclasesconva4.pdf`.
 */
export const CONVALIDATION_BOOKS: Record<
  ConvalidationLicense,
  {
    /** Curso donde está matriculado el alumno que convalida. */
    motherLicense: 'A5' | 'A2';
    /** Sufijo del ID del libro: `<código promoción>.<sufijo>` (ej. 156.6). */
    idSuffix: '6' | '7';
    /** Días de clase del tramo de convalidación (las últimas N fechas del curso madre). */
    sessionDays: number;
    /** Índices de `getModuleNames(evaluationLicense)` que tiene la página de Evaluaciones. */
    moduleIndexes: number[];
    /** Licencia cuyo catálogo de módulos se usa (define Transporte de Pasajeros vs Carga). */
    evaluationLicense: 'A3' | 'A4';
  }
> = {
  // Evaluaciones: Infraestructura, Mecánica, Transporte de Pasajeros, Conducción, Aspectos Psic.
  A3: {
    motherLicense: 'A5',
    idSuffix: '6',
    sessionDays: 16,
    moduleIndexes: [2, 3, 4, 5, 6],
    evaluationLicense: 'A3',
  },
  // Evaluaciones: Prevención de Riesgos, Mecánica, Transporte de Carga, Conducción, Aspectos Psic.
  A4: {
    motherLicense: 'A2',
    idSuffix: '7',
    sessionDays: 13,
    moduleIndexes: [1, 3, 4, 5, 6],
    evaluationLicense: 'A4',
  },
};

const CONVALIDATION_ORDER: ConvalidationLicense[] = ['A3', 'A4'];

/** 'A3' → 'Curso Convalidación Clase A-3' (nombre del libro, como en la portada real). */
export function getConvalidationBookName(conv: ConvalidationLicense): string {
  return `Curso Convalidación Clase A-${conv.slice(1)}`;
}

/** `156` + A3 → `156.6`. Sin código de promoción no inventa un ID. */
export function buildConvalidationBookId(
  promotionCode: string,
  conv: ConvalidationLicense,
): string {
  if (!promotionCode) return '';
  return `${promotionCode}.${CONVALIDATION_BOOKS[conv].idSuffix}`;
}

/** Las 5 asignaturas de la página de Evaluaciones del libro de convalidación. */
export function getConvalidationModuleNames(conv: ConvalidationLicense): string[] {
  const book = CONVALIDATION_BOOKS[conv];
  const all = getModuleNames(book.evaluationLicense);
  return book.moduleIndexes.map((i) => all[i]);
}

/**
 * Fechas del tramo de convalidación: las últimas `n` fechas activas (no `cancelled`) del curso
 * madre, ordenadas. Si hay menos de `n`, devuelve todas: nunca inventa fechas (AC-E3).
 */
export function selectConvalidationDates(
  sessions: { date: string; status: string | null }[],
  n: number,
): string[] {
  const active = [...new Set(sessions.filter((s) => s.status !== 'cancelled').map((s) => s.date))];
  active.sort();
  return active.slice(Math.max(0, active.length - n));
}

/**
 * Opciones del selector del Libro de Clases: los cursos de la promoción, en su orden, y después
 * Conv. A-3 y Conv. A-4. Un libro de convalidación solo aparece si existe su curso madre.
 */
export function buildBookOptions(cursos: CursoOption[]): LibroOption[] {
  const normal: LibroOption[] = cursos.map((c) => ({
    key: String(c.id),
    promotionCourseId: c.id,
    convalidation: null,
    label: `${c.courseCode} — ${c.courseName}`,
  }));

  const conv: LibroOption[] = [];
  for (const license of CONVALIDATION_ORDER) {
    const mother = cursos.find((c) => c.courseCode === CONVALIDATION_BOOKS[license].motherLicense);
    if (!mother) continue;
    conv.push({
      key: `${mother.id}:${license}`,
      promotionCourseId: mother.id,
      convalidation: license,
      label: `Conv. A-${license.slice(1)} — ${getConvalidationBookName(license)}`,
    });
  }

  return [...normal, ...conv];
}

/** Inverso de `LibroOption.key`. Devuelve `null` si la clave no es válida. */
export function parseBookKey(
  key: string,
): { promotionCourseId: number; convalidation: ConvalidationLicense | null } | null {
  const match = /^(\d+)(?::(A3|A4))?$/.exec(key);
  if (!match) return null;
  return {
    promotionCourseId: Number(match[1]),
    convalidation: (match[2] as ConvalidationLicense | undefined) ?? null,
  };
}
