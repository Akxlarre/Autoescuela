import { diffDaysIso } from './chile-time.utils';
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

/**
 * Cuánto puede adelantarse el número de una promoción manual respecto del último usado
 * (fix-347-m, D19). La siguiente automática toma "el mayor + 1": sin tope, un número mal tipeado
 * (2830 por 283) deja corrida toda la numeración.
 */
export const PROMOTION_CODE_MAX_AHEAD = 10;

/** Entero mayor que 0, sin ceros a la izquierda. */
export function isValidPromotionCode(code: string): boolean {
  return /^[1-9]\d*$/.test(code.trim());
}

/** Mayor número de promoción existente, o null si no hay ninguno. Ignora vacíos y no numéricos. */
export function maxPromotionCode(codes: readonly (string | null)[]): number | null {
  const numbers = codes
    .filter((c): c is string => c !== null && isValidPromotionCode(c))
    .map((c) => Number(c.trim()));
  return numbers.length > 0 ? Math.max(...numbers) : null;
}

/** Mayor número existente + 1. Ignora códigos vacíos o no numéricos. */
export function suggestNextPromotionCode(codes: readonly (string | null)[]): string {
  const max = maxPromotionCode(codes);
  return String(max !== null ? max + 1 : FIRST_PROMOTION_CODE);
}

/**
 * Mensaje de error del número de promoción para el formulario, o null si sirve. `maxExisting` es
 * el último número usado (null si todavía no se conoce o no hay ninguno: no se aplica el tope).
 */
export function promotionCodeError(code: string, maxExisting: number | null): string | null {
  const value = code.trim();
  if (value.length === 0) return 'El número es obligatorio.';
  if (!/^\d+$/.test(value)) return 'Debe ser solo números (ej: 281).';
  if (!isValidPromotionCode(value)) return 'Debe ser un número mayor que 0, sin ceros delante.';
  if (maxExisting !== null && Number(value) > maxExisting + PROMOTION_CODE_MAX_AHEAD) {
    return `No puede ser mayor que ${maxExisting + PROMOTION_CODE_MAX_AHEAD}: el último número usado es ${maxExisting}.`;
  }
  return null;
}

/**
 * Nombre de una promoción cuando su número cambia de `oldCode` a `newCode` (fix-346-m, D18). Si el
 * nombre guardado es el automático de su número ("Promoción 280 (5 de Octubre 2026)"), devuelve el
 * mismo con el número nuevo; un nombre escrito a mano, o un número nuevo inválido, lo deja igual.
 */
export function promotionNameForCode(name: string, oldCode: string, newCode: string): string {
  const from = oldCode.trim();
  const to = newCode.trim();
  const prefix = `Promoción ${from} (`;
  if (!from || !isValidPromotionCode(to) || !name.startsWith(prefix)) return name;
  return `Promoción ${to} (${name.slice(prefix.length)}`;
}

/**
 * Texto para mostrar una promoción con su número. Desde fix-323-m el nombre ya lo trae
 * ("Promoción 280 (5 de Octubre 2026)"): en ese caso no se repite. Las promociones antiguas
 * ("Promoción 15 de Junio 2026", número 103) lo llevan entre paréntesis (hotfix-146-m).
 */
export function promotionLabel(name: string, code: string | null | undefined): string {
  const number = (code ?? '').trim();
  if (!number) return name;
  const alreadyNamed =
    new RegExp(`(^|\\D)${number}(\\D|$)`).test(name) && isValidPromotionCode(number);
  return alreadyNamed ? name : `${name} (${number})`;
}

/**
 * Estado de un curso de promoción como opción del paso 2 de la matrícula (fix-351-m): cerrado si
 * no está planificado ni en curso; lleno si los inscritos alcanzan el cupo; si no, abierto.
 */
export function promotionOptionStatus(
  courseStatus: string | null,
  enrolledCount: number,
  maxCapacity: number,
): 'open' | 'full' | 'finished' {
  if (courseStatus !== 'planned' && courseStatus !== 'in_progress') return 'finished';
  return enrolledCount >= maxCapacity ? 'full' : 'open';
}

/**
 * Ordena los grupos de promociones del paso 2 de la matrícula por fecha de inicio, de la más
 * antigua a la más nueva; los que no tienen fecha van al final (hotfix-145-m). No muta la entrada.
 */
export function sortPromotionGroupsByStart<
  T extends { options: readonly { startDate: string | null }[] },
>(groups: readonly T[]): T[] {
  const startOf = (g: T): string => g.options[0]?.startDate ?? '9999-12-31';
  return [...groups].sort((a, b) => startOf(a).localeCompare(startOf(b)));
}

/** True si la fecha (YYYY-MM-DD) es un lunes de la cadencia automática. */
export function isCadenceDate(isoDate: string): boolean {
  const days = diffDaysIso(PROMOTION_CADENCE_ANCHOR, isoDate);
  return ((days % 14) + 14) % 14 === 0;
}

/**
 * Traduce las violaciones de unicidad de `professional_promotions` a un mensaje para el usuario.
 * Devuelve null para cualquier otro error (lo maneja el sanitizer).
 */
export function promotionWriteErrorMessage(err: unknown, code: string): string | null {
  if (!err || typeof err !== 'object') return null;
  const { code: pgCode, message } = err as { code?: string; message?: string };
  if (!message) return null;
  // Trigger de fix-325-m: no se cancela una promoción con matrículas activas.
  if (message.includes('promotion_has_active_enrollments')) {
    return 'No se puede cancelar: la promoción tiene alumnos con matrícula activa.';
  }
  // Rechazos de delete_promotion_without_students (fix-348-m).
  if (message.includes('promotion_has_enrollments')) {
    return 'No se puede eliminar: la promoción tiene alumnos matriculados.';
  }
  if (message.includes('promotion_not_deletable')) {
    return 'No se puede eliminar: la promoción ya partió.';
  }
  if (message.includes('promotion_not_found')) {
    return 'La promoción ya no existe.';
  }
  if (pgCode !== '23505') return null;
  if (message.includes('professional_promotions_code_key')) {
    return `El número ${code.trim()} ya lo usa otra promoción. Elige otro.`;
  }
  if (message.includes('professional_promotions_branch_start_date_key')) {
    return 'Ya hay una promoción que parte ese lunes. Elige otra fecha.';
  }
  return null;
}
