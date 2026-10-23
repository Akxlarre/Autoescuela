/**
 * Paginación completa contra PostgREST (fix-457-m).
 *
 * PostgREST corta toda respuesta en `max_rows = 1000` sin avisar (DG-008). Para listados que deben
 * traer todo, se piden páginas con `range(from, to)` hasta que una venga incompleta.
 *
 * La consulta que arma `fetchPage` necesita un orden estable (con `id` como desempate); si no,
 * dos páginas pueden solaparse o saltarse filas.
 */

/** Resultado mínimo de una consulta de Supabase: lo que devuelve `await query.range(...)`. */
export interface PageResult<T> {
  data: T[] | null;
  error: unknown;
}

/** Tamaño de página por defecto: el `max_rows` de `supabase/config.toml`. */
export const POSTGREST_MAX_ROWS = 1000;

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = POSTGREST_MAX_ROWS,
): Promise<{ data: T[] | null; error: unknown }> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}
