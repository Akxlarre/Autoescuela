/**
 * Errores de consola/red tolerados por la suite (spec 0019-m, AC8).
 *
 * Solo se agrega un error aquí si se revisó y se decidió que no es un bug a corregir ahora.
 * Toda entrada necesita una justificación: la suite no arranca si falta alguna.
 * Un error que sí es un bug se reporta (fix/asignación), no se agrega a esta lista.
 */

export interface KnownError {
  /** Se compara contra el texto del error de consola o contra "<status> <url>" de la respuesta. */
  pattern: RegExp;
  /** Por qué se tolera. Obligatorio. */
  reason: string;
}

export const KNOWN_ERRORS: KnownError[] = [];

export function validateKnownErrors(list: readonly KnownError[]): void {
  for (const entry of list) {
    if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
      throw new Error(
        `[e2e] El error tolerado ${String(entry.pattern)} no tiene justificación ` +
          `(e2e/support/known-errors.ts). La suite no se ejecuta.`,
      );
    }
  }
}

export function isKnownError(text: string, list: readonly KnownError[] = KNOWN_ERRORS): boolean {
  return list.some((entry) => entry.pattern.test(text));
}
