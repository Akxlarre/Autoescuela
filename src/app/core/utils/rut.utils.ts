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

/** Validates a Chilean RUT using the modulo-11 algorithm. */
export function validateRut(rut: string): boolean {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 2) return false;

  const body = cleaned.slice(0, -1);
  if (!/^\d+$/.test(body)) return false;

  const dv = cleaned.slice(-1).toUpperCase();
  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const rem = sum % 11;
  const expected = rem === 0 ? '0' : rem === 1 ? 'K' : String(11 - rem);
  return dv === expected;
}
