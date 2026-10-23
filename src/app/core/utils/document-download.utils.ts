/**
 * URL que fuerza la descarga de un documento guardado en Supabase Storage (fix-468-m).
 *
 * El atributo `download` de un enlace no aplica a URLs de otro origen: con una URL firmada de
 * Storage el navegador abría el archivo en una pestaña. Storage acepta `download=<nombre>` en URLs
 * firmadas y públicas (fuera del token) y responde con `Content-Disposition: attachment`.
 *
 * - Si `name` no trae la extensión del archivo, se le agrega.
 * - Devuelve `null` si la URL no es de Storage: ahí no hay forma de forzar la descarga.
 */
export function documentDownloadUrl(url: string, name: string): string | null {
  const [path] = url.split('?');
  if (!/\/storage\/v1\/object\/(sign|public)\//.test(path)) return null;

  const storageFileName = decodeURIComponent(path.split('/').pop() ?? '');
  const extension = storageFileName.includes('.') ? storageFileName.split('.').pop()! : '';

  const cleanName = name
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  let fileName = cleanName || storageFileName;
  if (extension && !fileName.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) {
    fileName = `${fileName}.${extension}`;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}download=${encodeURIComponent(fileName)}`;
}
