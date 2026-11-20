// supabase/functions/_shared/storage-urls.ts
//
// URL pública de un archivo de Storage, armada desde la URL del proyecto en el que corre la
// función. El ref del proyecto no se escribe en el código: con un ref fijo, un traspaso de
// proyecto deja los PDFs pidiendo el logo al proyecto viejo (fix-503-m).

export function publicStorageUrl(
  bucket: string,
  path: string,
  projectUrl: string = Deno.env.get('SUPABASE_URL') ?? '',
): string {
  if (!projectUrl) throw new Error('SUPABASE_URL no está definida');
  return `${projectUrl.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${path}`;
}

/** Logo institucional usado por los PDFs y la matrícula pública (bucket público `assets`). */
export const SCHOOL_LOGO_URL = (): string => publicStorageUrl('assets', 'chillan_capacita.png');
