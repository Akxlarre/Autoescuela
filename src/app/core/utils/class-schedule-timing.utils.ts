/**
 * True cuando una clase sigue en `scheduled` (no iniciada) pero su hora de inicio
 * ya pasó respecto a `now`. `scheduledAt` es un timestamp completo (con offset), así
 * que la comparación es un instante absoluto — no hay ambigüedad de timezone como
 * con comparaciones de solo-fecha (ver fix-176).
 */
export function isClassStartOverdue(
  scheduledAt: string | null | undefined,
  status: string,
  now: Date = new Date(),
): boolean {
  if (status !== 'scheduled' || !scheduledAt) return false;
  return new Date(scheduledAt).getTime() < now.getTime();
}
