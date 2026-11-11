// supabase/functions/_shared/payroll-totals.ts
//
// Funciones puras para redondeo y cálculo de totales en nómina de instructores.
// Sin I/O ni globals de Deno para poder probarse unitariamente con `deno test`.
// Lo usa `generate-payroll-report`.

/** Redondea horas equivalentes (NUMERIC(6,1)) a 1 decimal para evitar deriva IEEE-754. */
export function roundPayrollHours(hours: number): number {
  return Math.round(hours * 10) / 10;
}

/** Suma horas equivalentes de una lista de filas manteniendo precisión de 1 decimal. */
export function sumPayrollHours(rows: ReadonlyArray<{ totalHours: number }>): number {
  return roundPayrollHours(rows.reduce((sum, row) => sum + row.totalHours, 0));
}

/** Calcula el sueldo base CLP entero redondeado a partir de horas y tarifa por hora. */
export function calcPayrollBaseAmount(totalHours: number, amountPerHour: number): number {
  return Math.round(totalHours * amountPerHour);
}
