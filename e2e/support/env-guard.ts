/**
 * Verificación de BD objetivo (spec 0019-m, AC3).
 *
 * La suite corre contra la BD de desarrollo compartida del equipo. Si la app apunta a
 * cualquier otro proyecto Supabase (ej. producción, cuando exista), se aborta antes de
 * ejecutar un solo test.
 */

/** Refs de proyectos Supabase contra los que la suite tiene permitido correr. */
export const ALLOWED_SUPABASE_REFS = ['skvekggejikzxhzsjmkz'];

export function assertDevSupabase(url: string, allowedRefs: readonly string[]): void {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`[e2e] URL de Supabase inválida: "${url}". La suite no se ejecuta.`);
  }

  const allowedHosts = allowedRefs.map((ref) => `${ref}.supabase.co`);
  if (!allowedHosts.includes(host)) {
    throw new Error(
      `[e2e] La app apunta a ${url}, que no es la BD de desarrollo ` +
        `(permitidos: ${allowedHosts.join(', ') || 'ninguno'}). La suite no se ejecuta.`,
    );
  }
}
