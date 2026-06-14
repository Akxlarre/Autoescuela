/**
 * Convierte un valor KPI (string | number) al string de display.
 * - number → String(n)
 * - string vacío → '—' (fallback)
 * - string no vacío → tal cual
 */
export function kpiDisplayValue(value: string | number): string {
  if (typeof value === 'string') return value === '' ? '—' : value;
  return String(value);
}
