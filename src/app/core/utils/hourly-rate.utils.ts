/**
 * Tarifa por hora de instructores válida (fix-210-b, S22 de ASG-i-034): entero mayor a 0.
 * `branch_payroll_config.amount_per_hour` es INTEGER (un decimal vuelve como error de Postgres) y
 * una tarifa 0 deja en $0 todas las liquidaciones de la sede.
 */
export function isValidHourlyRate(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
