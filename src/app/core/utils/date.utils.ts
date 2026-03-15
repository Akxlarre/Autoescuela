/**
 * Centralized date and currency utilities for the project (Target: es-CL).
 */

/**
 * Returns a date string in YYYY-MM-DD format (ISO local).
 * Replaces the 'en-CA' locale trick.
 */
export function toISODate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date.includes('T') ? date : date + 'T12:00:00') : date;
  if (isNaN(d.getTime())) return '';
  
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns a time string in HH:MM format (24h).
 * Replaces the 'en-GB' locale trick.
 */
export function to24hTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  return d.toLocaleTimeString('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Formats a date for display in Chilean format (es-CL).
 * Example: "14 mar. 2026" or "sábado, 14 de marzo" depending on options.
 */
export function formatChileanDate(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date.includes('T') ? date : date + 'T12:00:00') : date;
  if (isNaN(d.getTime())) return '—';
  
  return d.toLocaleDateString('es-CL', options);
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
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return '—';

  const dayName = d.toLocaleDateString('es-CL', { weekday: 'short' });
  const dayNum = d.toLocaleDateString('es-CL', { day: 'numeric' });
  const month = d.toLocaleDateString('es-CL', { month: 'short' });
  
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
