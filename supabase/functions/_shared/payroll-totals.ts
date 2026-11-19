// supabase/functions/_shared/payroll-totals.ts
//
// Funciones puras para redondeo y cálculo de totales en nómina de instructores.
// Sin I/O ni globals de Deno para poder probarse unitariamente con `deno test`.
// Lo usa `generate-payroll-report`.
//
// spec 0012-i AC17: horas exactas (0,75 por clase; 3 clases = 2,25 h), dos decimales.
// Espejo de `src/app/core/utils/payroll-hours.utils.ts`.

/** Redondea horas (NUMERIC(6,2)) a 2 decimales para evitar deriva IEEE-754. */
export function roundPayrollHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

/** Suma horas de una lista de filas manteniendo precisión de 2 decimales. */
export function sumPayrollHours(rows: ReadonlyArray<{ totalHours: number }>): number {
  return roundPayrollHours(rows.reduce((sum, row) => sum + row.totalHours, 0));
}

/** Formato para mostrar en el PDF: siempre dos decimales con coma ("2,25", "3,00"). */
export function formatPayrollHours(hours: number): string {
  return roundPayrollHours(hours).toFixed(2).replace('.', ',');
}

/** Calcula el sueldo base CLP entero redondeado a partir de horas y tarifa por hora. */
export function calcPayrollBaseAmount(totalHours: number, amountPerHour: number): number {
  return Math.round(totalHours * amountPerHour);
}
