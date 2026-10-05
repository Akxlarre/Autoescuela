/**
 * Número de promoción ("ID numérico MTT") y cadencia de Clase Profesional (fix-323-m).
 *
 * El número arma el código de los cursos (`280.2` para A2) y el ID del libro de clases; en BD es
 * único (`professional_promotions_code_key`). La cadencia automática son los lunes cada 14 días a
 * partir de `PROMOTION_CADENCE_ANCHOR` — mismo ancla que `reserve_next_promotion_slot()`.
 */

/** Primer lunes de la cadencia de 14 días. Debe coincidir con la migración de fix-323-m. */
export const PROMOTION_CADENCE_ANCHOR = '2026-07-27';

/** Número usado si todavía no existe ninguno (mismo fallback que la creación automática). */
const FIRST_PROMOTION_CODE = 276;

const DAY_MS = 86_400_000;

export function isValidPromotionCode(code: string): boolean {
  return /^\d+$/.test(code.trim());
}

/** Mayor número existente + 1. Ignora códigos vacíos o no numéricos. */
export function suggestNextPromotionCode(codes: readonly (string | null)[]): string {
  const numbers = codes
    .filter((c): c is string => c !== null && isValidPromotionCode(c))
    .map((c) => Number(c.trim()));
  return String(numbers.length > 0 ? Math.max(...numbers) + 1 : FIRST_PROMOTION_CODE);
}

/** True si la fecha (YYYY-MM-DD) es un lunes de la cadencia automática. */
export function isCadenceDate(isoDate: string): boolean {
  const days = Math.round(
    (Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${PROMOTION_CADENCE_ANCHOR}T00:00:00Z`)) /
      DAY_MS,
  );
  return ((days % 14) + 14) % 14 === 0;
}

/**
 * Traduce las violaciones de unicidad de `professional_promotions` a un mensaje para el usuario.
 * Devuelve null para cualquier otro error (lo maneja el sanitizer).
 */
export function promotionWriteErrorMessage(err: unknown, code: string): string | null {
  if (!err || typeof err !== 'object') return null;
  const { code: pgCode, message } = err as { code?: string; message?: string };
  if (pgCode !== '23505' || !message) return null;
  if (message.includes('professional_promotions_code_key')) {
    return `El número ${code.trim()} ya lo usa otra promoción. Elige otro.`;
  }
  if (message.includes('professional_promotions_branch_start_date_key')) {
    return 'Ya hay una promoción que parte ese lunes. Elige otra fecha.';
  }
  return null;
}
