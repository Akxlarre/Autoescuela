const ALLOWED_DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Valida un archivo de documento (PDF/imagen, máx. 5 MB) — regla compartida por todos los
 * puntos de subida de documentos (DMS, creación de instructor). Devuelve el mensaje de error
 * en español listo para mostrar, o `null` si el archivo es válido.
 *
 * El tipo es el MIME que declara el navegador (sale de la extensión). Para revisar además el
 * contenido real, usar `checkDocumentFile()`.
 */
export function validateDocumentFile(file: File): string | null {
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) {
    return 'Solo se permiten archivos PDF, JPG, PNG o WEBP.';
  }
  if (file.size === 0) {
    return 'El archivo está vacío.';
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return 'El archivo no puede superar los 5 MB.';
  }
  return null;
}

/** Firmas de los primeros bytes: `null` en una posición = cualquier byte. */
const SIGNATURES: (number | null)[][] = [
  [0x25, 0x50, 0x44, 0x46], // %PDF
  [0xff, 0xd8, 0xff], // JPEG
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // PNG
  [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50], // RIFF....WEBP
];

/** true si los primeros bytes son de un PDF, JPEG, PNG o WEBP. */
export function isAllowedDocumentSignature(bytes: Uint8Array): boolean {
  return SIGNATURES.some((sig) => sig.every((b, i) => b === null || bytes[i] === b));
}

/**
 * fix-474-m: `validateDocumentFile()` + que el contenido sea de verdad un PDF o una imagen
 * permitida. La extensión sola deja pasar un `.exe` renombrado a `.pdf`.
 */
export async function checkDocumentFile(file: File): Promise<string | null> {
  const ruleError = validateDocumentFile(file);
  if (ruleError) return ruleError;
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  return isAllowedDocumentSignature(head) ? null : 'El archivo no es un PDF o una imagen válida.';
}
