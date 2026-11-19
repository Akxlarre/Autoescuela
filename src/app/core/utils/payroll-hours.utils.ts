/**
 * Horas de nómina de instructores (spec 0012-i AC17).
 *
 * Cada clase práctica completada vale 0,75 h y se paga exacta: 3 clases = 2,25 h, no 2,3. La base
 * guarda `instructor_monthly_hours.total_equivalent` como NUMERIC(6,2); aquí se trabaja con dos
 * decimales para no arrastrar la deriva de punto flotante al sumar.
 *
 * Espejo de `supabase/functions/_shared/payroll-totals.ts` (Excel/PDF de nómina).
 */

/** Redondea a 2 decimales (2,25 se mantiene; 0,1 + 0,2 → 0,3). */
export function roundPayrollHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

/** Suma las horas de varias filas, exacta a 2 decimales. */
export function sumPayrollHours(rows: ReadonlyArray<{ totalHours: number }>): number {
  return roundPayrollHours(rows.reduce((sum, row) => sum + row.totalHours, 0));
}

/** Formato para mostrar: siempre dos decimales con coma ("2,25", "3,00"). */
export function formatPayrollHours(hours: number): string {
  return roundPayrollHours(hours).toFixed(2).replace('.', ',');
}
