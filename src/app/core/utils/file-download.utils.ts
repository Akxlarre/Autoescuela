/**
 * Descarga un archivo generado en memoria (PDF, etc.) con el nombre indicado.
 * Crea un enlace temporal, lo pulsa y libera la URL.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
