/**
 * Centralized date and currency utilities for the project (Target: es-CL).
 */

import {
  addMonthsIso,
  calendarDateToIso,
  chileToday,
  formatChileDate,
  formatChileTime,
  isoToCalendarDate,
  toChileDate,
} from './chile-time.utils';

/** Hoy en Chile, 'YYYY-MM-DD'. No depende del reloj ni de la zona del equipo. */
export function todayIso(): string {
  return chileToday();
}

/** Fecha 'YYYY-MM-DD' que está `months` meses antes de hoy (hoy en Chile). */
export function monthsAgoIso(months: number): string {
  return addMonthsIso(chileToday(), -months);
}

/**
 * Fecha 'YYYY-MM-DD' de un valor.
 *  - string → día de Chile (un instante se convierte; una fecha pura se devuelve tal cual).
 *  - Date   → se lee como FECHA DE CALENDARIO (la que entrega un selector de fechas).
 *
 * @deprecated El caso Date es ambiguo: no distingue un instante de un día de calendario.
 * En código nuevo usar `chileToday()`, `toChileDate(instante)` o `calendarDateToIso(fecha)`
 * de chile-time.utils.
 */
export function toISODate(date: Date | string): string {
  return typeof date === 'string' ? toChileDate(date) : calendarDateToIso(date);
}

/**
 * Fecha para mostrar como dd-mm-aaaa (día de Chile). "—" si no hay fecha o no es válida.
 */
export function formatDayMonthYear(date: string | null | undefined): string {
  if (!date) return '—';
  const iso = toISODate(date);
  if (!iso) return '—';
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Fecha pura ('YYYY-MM-DD') → Date de calendario para un selector de fechas.
 * Devuelve null si está vacía o no es válida.
 */
export function isoToDate(iso: string): Date | null {
  return isoToCalendarDate(iso);
}

/** Hora de pared de Chile 'HH:MM' (24 horas) de un instante. '' si no es válido. */
export function to24hTime(date: Date | string): string {
  const time = formatChileTime(date);
  return time === '—' ? '' : time;
}

/** Adds `minutes` to a 'HH:MM' time string, wrapping past midnight. */
export function addMinutesToTime(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Formats a date for display in Chilean format (es-CL).
 * Example: "14 mar. 2026" or "sábado, 14 de marzo" depending on options.
 */
export function formatChileanDate(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
): string {
  return formatChileDate(date, options);
}

/**
 * Capitalizes the first letter of a string.
 */
export function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Returns a human-readable day label (e.g., "Lun 14 Mar").
 */
export function buildDayLabel(dateStr: string): string {
  if (!toChileDate(dateStr)) return '—';

  const dayName = formatChileDate(dateStr, { weekday: 'short' });
  const dayNum = formatChileDate(dateStr, { day: 'numeric' });
  const month = formatChileDate(dateStr, { month: 'short' });

  return `${capitalize(dayName)} ${dayNum} ${capitalize(month).replace('.', '')}`;
}

/**
 * Formats a number as Chilean Pesos (CLP).
 */
export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount);
}
