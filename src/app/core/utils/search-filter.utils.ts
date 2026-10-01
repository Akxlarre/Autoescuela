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

/**
 * Como `matchesSearch`, pero tokeniza `query` por espacios y exige que CADA token matchee
 * en algún campo — no que la query completa esté en un único campo. Permite buscar
 * "nombre apellido" (en cualquier orden) aunque estén repartidos en campos separados.
 * Query vacía siempre matchea.
 *
 * Un token numérico (dígitos, puntos, guiones y `k`: un RUT o parte de uno) se compara además
 * sin puntuación, para que "12345678-9", "123456789" y "12.345" encuentren "12.345.678-9" — y
 * al revés, porque no todos los RUT están guardados con el mismo formato (fix-267-m).
 */
export function matchesSearchTokens(
  fields: Array<string | null | undefined>,
  query: string,
): boolean {
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const normalizedFields = fields.map((f) => normalizeSearchText(f));
  const haystack = normalizedFields.join(' ');
  // Sin puntuación campo por campo: así un token no puede matchear a caballo entre dos campos.
  const compactHaystack = normalizedFields.map(stripRutPunctuation).join(' ');

  return tokens.every((token) => {
    if (haystack.includes(token)) return true;
    if (!NUMERIC_TOKEN.test(token)) return false;
    const compactToken = stripRutPunctuation(token);
    return compactToken !== '' && compactHaystack.includes(compactToken);
  });
}

/** Token formado solo por dígitos, puntos, guiones y la `k` del dígito verificador. */
const NUMERIC_TOKEN = /^[\dk.-]+$/;

function stripRutPunctuation(value: string): string {
  return value.replace(/[.-]/g, '');
}

/** Filtra `items` por `query` tokenizada usando los campos que devuelva `getFields` por item. */
export function filterBySearchTokens<T>(
  items: T[],
  query: string,
  getFields: (item: T) => Array<string | null | undefined>,
): T[] {
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return items;
  return items.filter((item) => matchesSearchTokens(getFields(item), query));
}
