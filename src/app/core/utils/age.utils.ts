import { chileToday, monthDays, toChileDate } from './chile-time.utils';
import type { AgeAlertStatus } from '@core/models/ui/enrollment-personal-data.model';

/**
 * Returns true if the date string represents a calendar-impossible date
 * (e.g. Feb 29 on a non-leap year, April 31).
 * Returns false for empty strings and malformed input — those are "absent", not "impossible".
 */
export function isInvalidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  // Fechas imposibles (p. ej. 29 de febrero en un año no bisiesto).
  return month < 1 || month > 12 || day < 1 || day > monthDays(year, month);
}

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
  // La fecha de nacimiento es una fecha pura: se compara con el día de hoy en Chile.
  const birth = toChileDate(birthDate);
  if (!birth || isInvalidDate(birth)) return null;
  const today = chileToday();
  let age = Number(today.slice(0, 4)) - Number(birth.slice(0, 4));
  if (today.slice(5) < birth.slice(5)) age--;
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
