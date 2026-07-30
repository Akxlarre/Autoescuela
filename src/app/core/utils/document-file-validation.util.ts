const ALLOWED_DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Valida un archivo de documento (PDF/imagen, máx. 5 MB) — regla compartida por todos los
 * puntos de subida de documentos (DMS, creación de instructor). Devuelve el mensaje de error
 * en español listo para mostrar, o `null` si el archivo es válido.
 */
export function validateDocumentFile(file: File): string | null {
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) {
    return 'Solo se permiten archivos PDF, JPG, PNG o WEBP.';
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return 'El archivo no puede superar los 5 MB.';
  }
  return null;
}
