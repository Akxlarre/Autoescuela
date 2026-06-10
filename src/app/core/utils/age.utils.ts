import type { AgeAlertStatus } from '@core/models/ui/enrollment-personal-data.model';

/**
 * Determines the age-related alert status for the enrollment wizard.
 * Profesional age check (< 20) is evaluated BEFORE the minor check (< 18) so that
 * a 17-year-old selecting a professional course sees the professional restriction,
 * not the minor-authorization guidance (which would be misleading — they still
 * wouldn't qualify at 18 or 19).
 */
export function getAgeStatus(birthDate: string, courseType: string): AgeAlertStatus {
  const age = calcAge(birthDate);
  if (age === null) return 'none';
  if (age < 17) return 'under-17';
  if (courseType?.startsWith('professional') && age < 20) return 'under-20-professional';
  if (age < 18) return 'requires-authorization';
  return 'ok';
}

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
