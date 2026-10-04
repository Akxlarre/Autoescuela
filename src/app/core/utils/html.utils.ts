const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Convierte un texto en HTML seguro para insertarlo dentro de un mensaje que se pinta con
 * innerHTML (p. ej. el de ConfirmModalService). Todo dato que venga de la base —nombres, motivos,
 * observaciones— debe pasar por acá antes de entrar a un mensaje con etiquetas (fix-284-m).
 */
export function escapeHtml(text: string | null | undefined): string {
  return (text ?? '').replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}
