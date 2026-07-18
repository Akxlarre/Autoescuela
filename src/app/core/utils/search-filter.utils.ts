/**
 * Filtro de texto genérico para listas (Functional Core): case-insensitive y
 * ciego a acentos, para que "jose" encuentre "José" y "Núñez" se encuentre con "nunez".
 */

/** Normaliza para comparar: minúsculas + sin diacríticos + sin espacios extra. */
export function normalizeSearchText(value: string | null | undefined): string {
  if (!value) return '';
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** true si algún campo contiene la query normalizada. Query vacía siempre matchea. */
export function matchesSearch(fields: Array<string | null | undefined>, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery === '') return true;
  return fields.some((field) => normalizeSearchText(field).includes(normalizedQuery));
}

/** Filtra `items` por `query` usando los campos que devuelva `getFields` por item. */
export function filterBySearch<T>(
  items: T[],
  query: string,
  getFields: (item: T) => Array<string | null | undefined>,
): T[] {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery === '') return items;
  return items.filter((item) => matchesSearch(getFields(item), normalizedQuery));
}
