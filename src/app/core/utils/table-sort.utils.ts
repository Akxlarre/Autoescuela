/**
 * Orden de una tabla por columna (spec 0023-m). Functional Core.
 *
 * Generaliza lo que la spec 0020-m hizo para la Base de Alumnos B, para que cualquier lista
 * ordene igual: clic en el título → ascendente → descendente → orden por defecto, filas sin dato
 * al final en ambos sentidos y empates en su orden de llegada.
 */

export type SortDirection = 'asc' | 'desc';

export interface TableSort<F extends string> {
  field: F;
  direction: SortDirection;
}

/** Valor comparable de una fila en una columna. `null` = la fila no tiene ese dato. */
export type SortKey = string | number | null;

/** Texto de la celda, o `null` si está vacío o es el guion que las listas usan como "sin dato". */
export function textSortKey(value: string | undefined | null): string | null {
  const text = value?.trim() ?? '';
  return text === '' || text === '—' ? null : text;
}

/** Fecha ISO como número, o `null` si falta o no se puede leer. */
export function dateSortKey(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : time;
}

/** Cuerpo numérico del RUT (lo que va antes del guion), sin puntos. */
export function rutSortKey(rut: string): number | null {
  const digits = rut.split('-')[0].replace(/\D/g, '');
  return digits === '' ? null : Number(digits);
}

/** Sin tildes ni mayúsculas, y con los números comparados como números ("20" antes que "100"). */
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

function compareKeys(a: SortKey, b: SortKey): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/** Ordena por una columna. Devuelve una lista nueva; sin orden devuelve la misma lista. */
export function sortRows<T, F extends string>(
  rows: T[],
  sort: TableSort<F> | null,
  keyOf: (row: T, field: F) => SortKey,
): T[] {
  if (!sort) return rows;
  const factor = sort.direction === 'asc' ? 1 : -1;

  return rows
    .map((row) => ({ row, key: keyOf(row, sort.field) }))
    .sort((a, b) => {
      if (a.key === null || b.key === null) {
        if (a.key === b.key) return 0;
        return a.key === null ? 1 : -1;
      }
      return factor * compareKeys(a.key, b.key);
    })
    .map((entry) => entry.row);
}

/** Clic en el título: ascendente → descendente → orden por defecto. Otra columna parte ascendente. */
export function nextSort<F extends string>(
  current: TableSort<F> | null,
  field: F,
): TableSort<F> | null {
  if (current?.field !== field) return { field, direction: 'asc' };
  return current.direction === 'asc' ? { field, direction: 'desc' } : null;
}

/** Invierte el sentido del orden vigente. Sin orden elegido no hay nada que invertir. */
export function toggleSortDirection<F extends string>(
  current: TableSort<F> | null,
): TableSort<F> | null {
  if (!current) return null;
  return { field: current.field, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

/** Valor de `aria-sort` del `<th>` de una columna. */
export function ariaSortOf<F extends string>(
  sort: TableSort<F> | null,
  field: F,
): 'ascending' | 'descending' | 'none' {
  if (sort?.field !== field) return 'none';
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

/** Ícono del título: flecha del sentido en la columna activa, doble flecha en las demás. */
export function sortIconOf<F extends string>(sort: TableSort<F> | null, field: F): string {
  if (sort?.field !== field) return 'arrow-up-down';
  return sort.direction === 'asc' ? 'chevron-up' : 'chevron-down';
}
