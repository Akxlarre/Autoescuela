/**
 * Utilidades para el input de odómetro (kilometraje) de ancho fijo.
 *
 * El odómetro se muestra con una fuente grande dentro de una caja de ancho FIJO
 * (estética "tablero de vehículo"). Con números de 6 dígitos (hasta 999.999 km,
 * el máximo real) el texto se sale de la caja y se pierde la visualización.
 * Estas funciones eligen un tamaño de fuente adaptativo para que el número SIEMPRE
 * quepa completo, sin depender de Angular (Functional Core → testeable en aislamiento).
 */

/** Tier de fuente para el odómetro (mapea a `text-{tier}` de Tailwind). */
export type OdometerFontTier = '5xl' | '4xl' | '3xl';

/** Cantidad de dígitos enteros del valor (0 para vacío/no numérico). */
export function odometerDigitCount(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return String(Math.abs(Math.trunc(n))).length;
}

/**
 * Tier de fuente según los dígitos, calibrado para la caja `w-36` (144px) del
 * drawer "Iniciar clase":
 *  - ≤5 dígitos → `5xl` (48px, ~134px máx) — tamaño dramático por defecto.
 *  - 6 dígitos  → `4xl` (36px, ~121px) — se achica para caber.
 *  - ≥7 dígitos → `3xl` (30px) — valor fuera de rango (inválido) pero legible.
 */
export function odometerFontTier(value: number | string | null | undefined): OdometerFontTier {
  const digits = odometerDigitCount(value);
  if (digits >= 7) return '3xl';
  if (digits === 6) return '4xl';
  return '5xl';
}
