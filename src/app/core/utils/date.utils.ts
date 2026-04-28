/**
 * Centralized date and currency utilities for the project (Target: es-CL).
 */

/** Returns today's date as YYYY-MM-DD string in local time. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns a date string in YYYY-MM-DD format (ISO local).
 * Replaces the 'en-CA' locale trick.
 */
export function toISODate(date: Date | string): string {
  const d =
    typeof date === 'string' ? new Date(date.includes('T') ? date : date + 'T12:00:00') : date;
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
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
): string {
  if (!date) return '—';
  const d =
    typeof date === 'string' ? new Date(date.includes('T') ? date : date + 'T12:00:00') : date;
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

/**
 * Returns UTC-anchored ISO start/end timestamps for a full day in Chile (America/Santiago).
 * Handles CLT (UTC-4) and CLST (UTC-3) automatically.
 *
 * Example (CLT, UTC-4):
 *   getChileDateTimeRange('2026-04-27')
 *   → { start: '2026-04-27T00:00:00-04:00', end: '2026-04-27T23:59:59-04:00' }
 *
 * Use in Supabase .gte/.lte filters so PostgreSQL interprets times in Santiago timezone,
 * not UTC — prevents evening payments being silently excluded.
 */
export function getChileDateTimeRange(isoDate: string): { start: string; end: string } {
  // Sample noon UTC on that date to determine the Santiago offset without DST ambiguity.
  const sampleDate = new Date(`${isoDate}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Santiago',
    timeZoneName: 'shortOffset',
  }).formatToParts(sampleDate);
  const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-4';
  const m = raw.match(/GMT([+-])(\d+)/);
  const offset = m ? `${m[1]}${m[2].padStart(2, '0')}:00` : '-04:00';
  return {
    start: `${isoDate}T00:00:00${offset}`,
    end: `${isoDate}T23:59:59${offset}`,
  };
}
