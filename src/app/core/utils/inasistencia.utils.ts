/**
 * true si una inasistencia de clase práctica todavía se puede justificar (hotfix-128-m). No, si
 * ya está justificada o si la clase ya se reagendó: esa inasistencia quedó archivada y dejó de
 * penalizar.
 */
export function canJustificarInasistencia(inasistencia: {
  justificada: boolean;
  reagendada: boolean;
}): boolean {
  return !inasistencia.justificada && !inasistencia.reagendada;
}
