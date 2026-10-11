/**
 * Sesiones de `class_b_sessions` consideradas válidas para mostrar en UI (Dashboard,
 * Asistencia B). Excluye 'reserved' (hold provisional creado en el Paso 2 del wizard de
 * matrícula, antes de la confirmación final) y 'cancelled'.
 */
export const VALID_CLASS_B_SESSION_STATUSES = [
  'scheduled',
  'in_progress',
  'completed',
  'no_show',
] as const;

/** Una inasistencia vigente de una clase práctica. */
export interface ClassBAbsence {
  enrollmentId: number;
  classNumber: number | null;
}

/**
 * Matrículas con faltas en dos clases seguidas (N y N+1): la misma regla que aplica
 * `apply_class_b_absence_penalty()` (RF-053). Dos faltas separadas no cuentan.
 */
export function enrollmentsWithConsecutiveAbsences(absences: ClassBAbsence[]): number[] {
  const numbersByEnrollment = new Map<number, Set<number>>();
  for (const { enrollmentId, classNumber } of absences) {
    if (classNumber == null) continue;
    const numbers = numbersByEnrollment.get(enrollmentId) ?? new Set<number>();
    numbers.add(classNumber);
    numbersByEnrollment.set(enrollmentId, numbers);
  }

  return [...numbersByEnrollment.entries()]
    .filter(([, numbers]) => [...numbers].some((n) => numbers.has(n + 1)))
    .map(([enrollmentId]) => enrollmentId);
}

/**
 * Matrículas con el horario eliminado: tienen clases FUTURAS canceladas y ninguna agendada.
 * Es justo el estado que "Reactivar" puede revertir (fix-365-m).
 */
export function enrollmentsWithRemovedSchedule(
  futureSessions: { enrollmentId: number; status: string }[],
): Set<number> {
  const cancelled = new Set<number>();
  const scheduled = new Set<number>();
  for (const { enrollmentId, status } of futureSessions) {
    if (status === 'cancelled') cancelled.add(enrollmentId);
    else if (status === 'scheduled') scheduled.add(enrollmentId);
  }
  return new Set([...cancelled].filter((id) => !scheduled.has(id)));
}

/** Clases de un alumno que una acción masiva va a cambiar. */
export interface ScheduleChangeGroup {
  alumnoName: string;
  clases: number;
}

const clasesLabel = (n: number): string => `${n} ${n === 1 ? 'clase' : 'clases'}`;

/**
 * Texto de confirmación de "Borrar horarios": cuántas clases futuras se cancelan y de quiénes.
 * Lista hasta `maxNames` alumnos y resume el resto.
 */
export function buildClearScheduleMessage(groups: ScheduleChangeGroup[], maxNames = 8): string {
  const total = groups.reduce((sum, g) => sum + g.clases, 0);
  const alumnos = groups.length;

  const header =
    total === 1
      ? `Se cancelará 1 clase futura de ${alumnos} ${alumnos === 1 ? 'alumno' : 'alumnos'}:`
      : `Se cancelarán ${total} clases futuras de ${alumnos} ${alumnos === 1 ? 'alumno' : 'alumnos'}:`;

  const lines = groups.slice(0, maxNames).map((g) => `• ${g.alumnoName}: ${clasesLabel(g.clases)}`);
  const rest = alumnos - maxNames;
  if (rest > 0) lines.push(`• y ${rest} ${rest === 1 ? 'alumno' : 'alumnos'} más`);

  return [
    header,
    ...lines,
    '',
    'Las clases de horas ya pasadas no se tocan. Para devolverles la agenda hay que reagendarlas desde la ficha de cada alumno.',
  ].join('\n');
}
