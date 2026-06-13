/**
 * Returns the input with digits and unsupported symbols removed.
 * Preserves Unicode letters (including accented and ñ), spaces, hyphens, apostrophes.
 */
export function stripInvalidNameChars(raw: string): string {
  return raw.replace(/[^\p{L}\s\-']/gu, '');
}

/**
 * Returns true if the name contains only valid characters and is at least 2 chars long.
 * Valid chars: Unicode letters, spaces, hyphens, apostrophes.
 */
export function validateName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  return !/[^\p{L}\s\-']/u.test(trimmed);
}
