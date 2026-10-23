/**
 * Estados posibles de una matrícula (`enrollments.status`).
 * La BD lo guarda como `string`; este union es la fuente de verdad para la UI.
 */
export type EnrollmentStatus = 'draft' | 'active' | 'pending_payment' | 'completed' | 'cancelled';

/** Veredicto de la regla de re-matrícula (fix-020). */
export type ReenrollmentVerdict = 'block' | 'confirm' | 'allow';

/**
 * Estados "en curso": existe una matrícula viva en el mismo curso, por lo que
 * NO se puede crear otra (no se puede estar matriculado dos veces a la vez).
 */
export const BLOCKING_STATUSES: readonly EnrollmentStatus[] = [
  'draft',
  'active',
  'pending_payment',
];

/**
 * Estados "históricos": la matrícula terminó (egresó o se canceló). Volver a
 * matricularse es legítimo (ej. obtuvo licencia hace años y debe re-aprender),
 * pero requiere confirmación explícita del operador.
 */
export const HISTORICAL_STATUSES: readonly EnrollmentStatus[] = ['completed', 'cancelled'];

/**
 * Núcleo funcional de la regla de re-matrícula (fix-020).
 *
 * Decide si un alumno puede crear una nueva matrícula en un curso, a partir de
 * los estados de sus matrículas existentes EN ESE MISMO curso:
 *
 *  - `block`   → hay al menos una matrícula en curso (`active`/`pending_payment`/`draft`).
 *  - `confirm` → solo hay matrículas históricas (`completed`/`cancelled`).
 *  - `allow`   → no hay matrícula previa real en este curso.
 *
 * Un estado no reconocido se trata como `block` (conservador): ante la duda,
 * no se permite duplicar sin que un humano lo revise.
 *
 * Data-in / data-out: sin dependencias de Angular, testeable al instante.
 * Esta es la ÚNICA fuente de la regla en el frontend; el flujo público la
 * replica en `supabase/functions/_shared/` (Deno no puede importar este módulo).
 */
/**
 * Curso de la matrícula que bloquea una nueva (fix-066-i): la primera que no es histórica.
 * El bloqueo se decide por clase de licencia, así que puede ser otro curso que el elegido
 * (Clase B en curso bloquea Refuerzo Clase B).
 */
export function pickBlockingCourseName(
  rows: readonly { status: string | null | undefined; courseName: string | null | undefined }[],
): string | null {
  const blocking = rows.find(
    (r) => !!r.status && !(HISTORICAL_STATUSES as readonly string[]).includes(r.status),
  );
  return blocking?.courseName ?? null;
}

/** Aviso de matrícula duplicada: nombra el curso en curso y, si es otro, también el elegido. */
export function duplicateEnrollmentMessage(
  fullName: string,
  blockingCourseName: string | null,
  chosenCourseName: string,
): string {
  const inCourse = blockingCourseName ?? chosenCourseName;
  const tail =
    inCourse === chosenCourseName
      ? 'No es posible crear una nueva mientras esa siga vigente.'
      : `No es posible matricularlo/a en ${chosenCourseName} mientras esa siga vigente.`;
  return `${fullName} ya tiene una matrícula en curso en ${inCourse}. ${tail}`;
}

export function evaluateReenrollment(
  existingStatuses: readonly (string | null | undefined)[],
): ReenrollmentVerdict {
  // Solo filas reales (descartar null/undefined de joins vacíos).
  const statuses = existingStatuses.filter(
    (s): s is string => typeof s === 'string' && s.length > 0,
  );

  if (statuses.length === 0) return 'allow';

  const isHistorical = (s: string): boolean =>
    (HISTORICAL_STATUSES as readonly string[]).includes(s);

  // 'block' gana: basta una matrícula en curso (o un estado desconocido) para bloquear.
  if (statuses.some((s) => !isHistorical(s))) return 'block';

  // Todas las matrículas son históricas → re-matrícula legítima con confirmación.
  return 'confirm';
}
