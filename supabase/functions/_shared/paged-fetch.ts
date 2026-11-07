// Lectura paginada con tope para edge functions (fix-488-m).
//
// PostgREST corta cada respuesta en `max_rows = 1000` sin error (DG-008): un `.limit(5000)` en una
// sola consulta devuelve 1.000 filas igual. Este helper pide páginas con `.range()` hasta agotar
// los datos o llegar a `cap`, y dice si quedó corto para que quien exporta pueda avisarlo.

export interface PageResult<T> {
  data: T[] | null;
  error: unknown;
  /** Total exacto (`{ count: 'exact' }`); se lee de la primera página. */
  count?: number | null;
}

export interface CappedRows<T> {
  rows: T[];
  /** Total de filas que cumplen el filtro (o las traídas, si la consulta no dio count). */
  total: number;
  /** true si había más filas que `cap` y no se trajeron todas. */
  truncated: boolean;
}

export async function fetchPagesCapped<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  { pageSize = 1000, cap }: { pageSize?: number; cap: number },
): Promise<CappedRows<T>> {
  const rows: T[] = [];
  let total: number | null = null;

  while (rows.length < cap) {
    const from = rows.length;
    const to = Math.min(from + pageSize, cap) - 1;
    const { data, error, count } = await fetchPage(from, to);
    if (error) throw error;
    if (total === null && typeof count === 'number') total = count;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < to - from + 1) break;
  }

  const finalTotal = total ?? rows.length;
  return { rows, total: finalTotal, truncated: finalTotal > rows.length };
}
