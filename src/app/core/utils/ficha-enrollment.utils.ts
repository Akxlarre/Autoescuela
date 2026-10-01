/**
 * Qué matrícula muestra la ficha del alumno (fix-265-m). Functional Core: sin Angular.
 */

/** Campos mínimos de una matrícula para decidir cuál mostrar. */
export interface FichaEnrollmentCandidate {
  id: number;
  status: string | null | undefined;
  created_at: string;
}

/**
 * Matrículas que no llegaron a completarse (wizard abandonado, Webpay fallido o cancelada).
 * Mismo criterio con el que la Base de Alumnos elige la matrícula principal de cada fila
 * (`AdminAlumnosFacade`), para que lista y ficha muestren la misma.
 */
const INCOMPLETE_STATUSES: ReadonlySet<string> = new Set(['draft', 'cancelled', 'pending_payment']);

/**
 * Elige la matrícula que muestra la ficha:
 *
 * 1. La que el usuario ya tenía elegida (`preferredId`), si sigue existiendo y no es un borrador
 *    — un refresco de la ficha no debe cambiarla.
 * 2. Si no, la más reciente que no esté incompleta.
 * 3. Si todas están incompletas, la más reciente que no sea borrador.
 *
 * Un borrador nunca se muestra: es un wizard sin confirmar, no una matrícula.
 */
export function pickFichaEnrollment<T extends FichaEnrollmentCandidate>(
  enrollments: readonly T[],
  preferredId?: number | null,
): T | null {
  const candidates = enrollments
    .filter((e) => e.status !== 'draft')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (preferredId != null) {
    const preferred = candidates.find((e) => e.id === preferredId);
    if (preferred) return preferred;
  }

  return candidates.find((e) => !INCOMPLETE_STATUSES.has(e.status ?? '')) ?? candidates[0] ?? null;
}
