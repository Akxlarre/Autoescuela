/** Palabra que el modal de archivar con historial pide escribir para confirmar. */
export const ARCHIVE_CONFIRMATION_WORD = 'borrarlo';

/**
 * true solo si se escribió la palabra de confirmación exactamente como la pide el modal: en
 * minúsculas (hotfix-124-m). Los espacios al inicio y al final no cuentan.
 */
export function isArchiveConfirmationText(text: string): boolean {
  return text.trim() === ARCHIVE_CONFIRMATION_WORD;
}
