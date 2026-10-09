/**
 * Pure utility functions for Chilean RUT formatting and validation.
 *
 * RUT format: XX.XXX.XXX-X (e.g., 12.345.678-9 or 12.345.678-K)
 */

/** Strips dots and dashes, returns only digits and trailing K/k. */
export function cleanRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, '');
}

/**
 * Formats a raw RUT string with dots and dash as the user types.
 * Input can be partially typed (e.g., "123456" → "123.456").
 * Always uppercases K.
 */
export function formatRut(raw: string): string {
  const cleaned = cleanRut(raw).toUpperCase();
  if (cleaned.length === 0) return '';

  // Separate body from DV (last char) only when we have at least 2 chars
  if (cleaned.length === 1) return cleaned;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  // Add dots to the body (from right to left, every 3 digits)
  const reversedBody = body.split('').reverse().join('');
  const withDots = reversedBody
    .replace(/(\d{3})(?=\d)/g, '$1.')
    .split('')
    .reverse()
    .join('');

  return `${withDots}-${dv}`;
}

/**
 * Normalizes a RUT for DB storage: formatted with dots, dash, uppercase K.
 * Use this before persisting to ensure consistent format.
 */
export function normalizeRutForStorage(rut: string): string {
  return formatRut(rut);
}

/** Calcula el dígito verificador (módulo 11) para el cuerpo numérico de un RUT. */
export function calculateRutDv(body: string): string {
  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const rem = sum % 11;
  return rem === 0 ? '0' : rem === 1 ? 'K' : String(11 - rem);
}

/** Validates a Chilean RUT using the modulo-11 algorithm. */
export function validateRut(rut: string): boolean {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 2) return false;

  const body = cleaned.slice(0, -1);
  if (!/^\d+$/.test(body)) return false;

  const dv = cleaned.slice(-1).toUpperCase();
  return dv === calculateRutDv(body);
}

/** Puntos de miles sobre el cuerpo numérico ("11111111" → "11.111.111"). */
function dotBody(body: string): string {
  return body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * ¿El usuario ya indicó el DV? Sí si escribió un guion o una K (que solo puede ser DV).
 * Sin eso, lo escrito es solo el número (ASG-b-047: el DV se pone solo).
 */
function hasExplicitDv(raw: string): boolean {
  return raw.includes('-') || /k/i.test(raw);
}

/**
 * Formato mientras se escribe (fix-213-b). A diferencia de `formatRut`, no toma el último dígito
 * como DV: sin guion solo pone puntos al número; con guion (o K) formatea cuerpo-DV.
 */
export function formatRutTyping(raw: string): string {
  const cleaned = cleanRut(raw).toUpperCase();
  if (cleaned.length === 0) return raw.includes('-') ? '-' : '';
  if (!hasExplicitDv(raw)) return dotBody(cleaned);
  if (raw.trimEnd().endsWith('-') && !/K/.test(cleaned)) return `${dotBody(cleaned)}-`;
  return formatRut(cleaned);
}

/**
 * Al salir del campo (fix-213-b, ASG-b-047): completa el DV **solo si falta**.
 * - Sin guion ni K: el número entero es el cuerpo y se agrega el DV calculado. Con 9+ dígitos no
 *   puede ser solo cuerpo, así que el último es el DV.
 * - Con guion o K: se respeta lo escrito. Nunca reemplaza un DV: si está mal, `validateRut` lo marca.
 * Idempotente. Antes (`autocompleteRutDv`) siempre tomaba el último dígito como DV y lo recalculaba:
 * se comía un dígito del número y ocultaba los RUT mal tecleados.
 */
export function completeRutDv(raw: string): string {
  const cleaned = cleanRut(raw).toUpperCase();
  if (cleaned.length === 0) return raw;
  if (hasExplicitDv(raw) || cleaned.length >= 9) return formatRut(cleaned);
  if (!/^\d+$/.test(cleaned)) return raw;
  return formatRut(`${cleaned}${calculateRutDv(cleaned)}`);
}
