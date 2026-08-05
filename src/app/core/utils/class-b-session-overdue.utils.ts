/** Minutos de retraso desde la hora de fin agendada a partir de los cuales una
 * sesión `in_progress` se considera atrasada (spec 0001-i, AC3). */
const OVERDUE_THRESHOLD_MIN = 15;

/**
 * Determina si una sesión práctica sigue `in_progress` más allá de su hora de
 * fin agendada (scheduledAt + durationMin) más el umbral de atraso. Solo
 * aplica a sesiones `in_progress` — `pending`/`completed` nunca están
 * "atrasadas" en este sentido.
 */
export function isSessionOverdue(
  scheduledAt: string,
  durationMin: number,
  status: string,
  now: Date = new Date(),
): boolean {
  if (status !== 'in_progress' || !scheduledAt) return false;

  const scheduledEnd = new Date(scheduledAt).getTime() + durationMin * 60000;
  const overdueThreshold = scheduledEnd + OVERDUE_THRESHOLD_MIN * 60000;

  return now.getTime() >= overdueThreshold;
}
