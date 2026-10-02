/** Palabra que el modal de archivar con historial pide escribir para confirmar. */
export const ARCHIVE_CONFIRMATION_WORD = 'borrarlo';

/**
 * Aviso de por qué no se puede archivar a un alumno con clases agendadas a futuro (fix-277-m):
 * dice cuántas tiene y qué hay que hacer antes.
 */
export function buildFutureClassesBlockMessage(futureClasses: number): string {
  return futureClasses === 1
    ? 'Tiene 1 clase agendada. Cancélala o reagéndala antes de archivar al alumno.'
    : `Tiene ${futureClasses} clases agendadas. Cancélalas o reagéndalas antes de archivar al alumno.`;
}

/**
 * true solo si se escribió la palabra de confirmación exactamente como la pide el modal: en
 * minúsculas (hotfix-124-m). Los espacios al inicio y al final no cuentan.
 */
export function isArchiveConfirmationText(text: string): boolean {
  return text.trim() === ARCHIVE_CONFIRMATION_WORD;
}
