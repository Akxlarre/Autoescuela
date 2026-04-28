/**
 * Calculates age in full years from a birth date string (YYYY-MM-DD).
 * Returns null if the date is empty or invalid.
 */
export function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/**
 * Returns true if the given birth date corresponds to a person under 18.
 * Defaults to false when the date is empty or invalid.
 */
export function isMinor(birthDate: string | null | undefined): boolean {
  const age = calcAge(birthDate);
  return age !== null && age < 18;
}
