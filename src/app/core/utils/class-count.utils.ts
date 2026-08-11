/**
 * Convierte horas prácticas de un curso a cantidad de clases, usando la misma
 * duración de sesión (45 min) que ya asume el wizard de matrícula. Único punto
 * de esta fórmula — evita hardcodear "12" en el gate del certificado y los KPIs.
 */
export function classCountFromPracticalHours(
  practicalHours: number | null,
  sessionMinutes = 45,
): number {
  if (!practicalHours) return 0;
  return Math.round((practicalHours * 60) / sessionMinutes);
}
