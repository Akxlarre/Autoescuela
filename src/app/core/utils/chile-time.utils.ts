/**
 * Hora de Chile — único lugar de la app donde un instante se convierte en día de negocio
 * (y un día en un rango de instantes).
 *
 * Dos tipos y nada más:
 *  - INSTANTE: un momento exacto. Viaja como Date o como ISO con zona (timestamptz en la BD).
 *  - FECHA PURA: un día de calendario 'YYYY-MM-DD' sin hora ni zona (date en la BD).
 *
 * Toda conversión entre ambos usa America/Santiago de forma explícita: no depende del reloj
 * ni de la zona horaria del equipo. La aritmética entre fechas puras no usa zona alguna.
 *
 * Copia espejo para edge functions: supabase/functions/_shared/chile-time.ts. Ambas corren
 * los casos de chile-time.vectors.json; un cambio acá se replica allá.
 */

export const CHILE_TIME_ZONE = 'America/Santiago';

const DAY_MS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HAS_ZONE = /(Z|[+-]\d{2}(:?\d{2})?)$/i;

export type ChileInstant = Date | string;

export interface ChileParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
  weekday: number; // 0 = domingo … 6 = sábado
}

/** Rango semiabierto [start, endExclusive) de instantes ISO en UTC. */
export interface InstantRange {
  start: string;
  endExclusive: string;
}

const PARTS_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: CHILE_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const pad = (n: number): string => String(n).padStart(2, '0');

function isoOf(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
}

/** Fecha pura → milisegundos de su medianoche UTC (solo como soporte de aritmética). */
function isoToUtcMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcMsToIso(ms: number): string {
  const d = new Date(ms);
  return isoOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function toDate(value: ChileInstant): Date | null {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d instanceof Date && !isNaN(d.getTime()) ? d : null;
}

function wallPartsOf(date: Date): Omit<ChileParts, 'weekday'> {
  const out: Record<string, number> = {};
  for (const part of PARTS_FORMAT.formatToParts(date)) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  return {
    year: out['year'],
    month: out['month'],
    day: out['day'],
    hour: out['hour'] % 24,
    minute: out['minute'],
    second: out['second'],
  };
}

/** Desfase de Chile respecto de UTC en ese instante, en milisegundos (negativo). */
function offsetMsAt(ms: number): number {
  const p = wallPartsOf(new Date(ms));
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - Math.floor(ms / 1000) * 1000;
}

// ─── Instante → hora de Chile ────────────────────────────────────────────────

/** Hora de pared de Chile de un instante. */
export function chileParts(instant: ChileInstant = new Date()): ChileParts {
  const d = toDate(instant);
  if (!d) throw new RangeError(`chileParts: instante inválido (${String(instant)})`);
  const p = wallPartsOf(d);
  return { ...p, weekday: weekdayOfIso(isoOf(p.year, p.month, p.day)) };
}

/**
 * Día de Chile ('YYYY-MM-DD') al que pertenece un valor.
 *  - Fecha pura → se devuelve tal cual.
 *  - Instante con zona (o Date) → su día en Chile.
 *  - Fecha y hora sin zona → se toma como hora de pared de Chile.
 * Devuelve '' si el valor está vacío o no es una fecha.
 */
export function toChileDate(value: ChileInstant | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') {
    const text = value.trim();
    const head = text.slice(0, 10);
    if (!DATE_ONLY.test(head)) return '';
    if (text.length === 10) return head;
    if (!HAS_ZONE.test(text)) return isNaN(isoToUtcMs(head)) ? '' : head;
  }
  const d = toDate(value);
  if (!d) return '';
  const p = wallPartsOf(d);
  return isoOf(p.year, p.month, p.day);
}

/** Hoy en Chile, 'YYYY-MM-DD'. */
export function chileToday(now: Date = new Date()): string {
  return toChileDate(now);
}

/** Mes actual en Chile, 'YYYY-MM'. */
export function chileMonth(now: Date = new Date()): string {
  return chileToday(now).slice(0, 7);
}

/** Año actual en Chile. */
export function chileYear(now: Date = new Date()): number {
  return Number(chileToday(now).slice(0, 4));
}

// ─── Hora de Chile → instante ────────────────────────────────────────────────

function wallToMs(iso: string, hour: number, minute: number): number {
  const [y, m, d] = iso.split('-').map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hour, minute);
  // Los dos desfases posibles alrededor de esa hora (antes y después de un cambio de horario).
  const candidates = [
    wallAsUtc - offsetMsAt(wallAsUtc - DAY_MS),
    wallAsUtc - offsetMsAt(wallAsUtc + DAY_MS),
  ].sort((a, b) => a - b);
  const matches = candidates.filter((ms) => {
    const p = wallPartsOf(new Date(ms));
    return p.day === d && p.month === m && p.hour === hour && p.minute === minute;
  });
  // Hora repetida (día de 25 horas): gana la primera vuelta.
  // Hora inexistente (día de 23 horas): se corre al otro lado del salto.
  return matches.length > 0 ? matches[0] : candidates[candidates.length - 1];
}

/** Instante ISO (UTC) de una hora de pared de Chile. `time` en 'HH:MM'. */
export function chileWallTimeToInstant(iso: string, time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  return new Date(wallToMs(iso, hour, minute || 0)).toISOString();
}

/** Primer instante cuyo día de Chile es `iso` (la medianoche puede no existir). */
function dayStartMs(iso: string): number {
  const midnight = wallToMs(iso, 0, 0);
  if (toChileDate(new Date(midnight)) === iso && toChileDate(new Date(midnight - 1)) !== iso) {
    return midnight;
  }
  // Medianoche inexistente o ambigua: buscar el borde exacto alrededor del candidato.
  let lo = midnight - 3 * 3_600_000;
  let hi = midnight + 3 * 3_600_000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (toChileDate(new Date(mid)) < iso) lo = mid;
    else hi = mid;
  }
  return hi;
}

/**
 * Rango de instantes de un día de Chile. Semiabierto: usar con `.gte(start)` y
 * `.lt(endExclusive)`. Cubre días de 23 y 25 horas, contiguo con los días vecinos.
 */
export function chileDayRange(iso: string): InstantRange {
  return chileRange(iso, iso);
}

/** Rango de instantes desde el inicio de `fromIso` hasta el fin de `toIso`, ambos incluidos. */
export function chileRange(fromIso: string, toIso: string): InstantRange {
  return {
    start: new Date(dayStartMs(fromIso)).toISOString(),
    endExclusive: new Date(dayStartMs(addDaysIso(toIso, 1))).toISOString(),
  };
}

/** Rango de instantes de un mes de Chile. `month` en 'YYYY-MM'. */
export function chileMonthRange(month: string): InstantRange {
  const first = `${month}-01`;
  return {
    start: new Date(dayStartMs(first)).toISOString(),
    endExclusive: new Date(dayStartMs(addMonthsIso(first, 1))).toISOString(),
  };
}

// ─── Aritmética de fechas puras (sin zona) ───────────────────────────────────

/** Suma (o resta) días de calendario a una fecha pura. */
export function addDaysIso(iso: string, days: number): string {
  return utcMsToIso(isoToUtcMs(iso) + days * DAY_MS);
}

/**
 * Suma (o resta) meses a una fecha pura. Si el mes destino es más corto, recorta al
 * último día (31-mar − 1 mes = 28-feb).
 */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const year = target.getUTCFullYear();
  const month = target.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return isoOf(year, month, Math.min(d, lastDay));
}

/** Cantidad de días de un mes de calendario. `month` de 1 a 12. */
export function monthDays(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Primer día ('YYYY-MM-DD') del mes de una fecha pura o de un 'YYYY-MM'. */
export function startOfMonthIso(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Último día ('YYYY-MM-DD') del mes de una fecha pura o de un 'YYYY-MM'. */
export function endOfMonthIso(iso: string): string {
  return addDaysIso(addMonthsIso(startOfMonthIso(iso), 1), -1);
}

/** Días de calendario desde `fromIso` hasta `toIso` (negativo si `toIso` es anterior). */
export function diffDaysIso(fromIso: string, toIso: string): number {
  return Math.round((isoToUtcMs(toIso) - isoToUtcMs(fromIso)) / DAY_MS);
}

/** Día de la semana de una fecha pura: 0 = domingo … 6 = sábado. */
export function weekdayOfIso(iso: string): number {
  return new Date(isoToUtcMs(iso)).getUTCDay();
}

/** Lunes de la semana (lunes a domingo) a la que pertenece una fecha pura. */
export function mondayOfIso(iso: string): string {
  return addDaysIso(iso, -((weekdayOfIso(iso) + 6) % 7));
}

// ─── Fecha de calendario de un selector (Date local) ─────────────────────────

/**
 * Fecha pura de un Date que representa un DÍA DE CALENDARIO elegido en un selector de
 * fechas (PrimeNG entrega la medianoche local de ese día). No es un instante: se leen sus
 * componentes locales. Para un instante usar `toChileDate`.
 */
export function calendarDateToIso(date: Date): string {
  if (isNaN(date.getTime())) return '';
  return isoOf(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Fecha pura → Date de calendario (mediodía local) para alimentar un selector de fechas. */
export function isoToCalendarDate(iso: string): Date | null {
  if (!iso || !DATE_ONLY.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0);
  return isNaN(date.getTime()) ? null : date;
}

// ─── Formato ─────────────────────────────────────────────────────────────────

/** Instante que representa a un valor para formatearlo en hora de Chile. */
function toFormattable(value: ChileInstant | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const day = toChileDate(value);
    if (!day) return null;
    // Fecha pura o sin zona: mediodía UTC cae siempre en ese mismo día en Chile.
    if (value.trim().length === 10) return new Date(`${day}T12:00:00Z`);
    if (!HAS_ZONE.test(value.trim())) {
      const time = value.trim().slice(11, 16) || '12:00';
      return new Date(wallToMs(day, Number(time.slice(0, 2)), Number(time.slice(3, 5))));
    }
  }
  return toDate(value);
}

/**
 * Fecha en es-CL con la zona de Chile fija. Una fecha pura no se desplaza.
 * Devuelve "—" si el valor está vacío o no es una fecha.
 */
export function formatChileDate(
  value: ChileInstant | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
): string {
  const d = toFormattable(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('es-CL', { ...options, timeZone: CHILE_TIME_ZONE }).format(d);
}

const PATTERN_TOKEN = /'((?:[^']|'')*)'|yyyy|MMMM|MMM|MM|EEEE|EEE|dd|d|HH|mm|ss/g;

/** Nombre en es-CL de una parte de la fecha, sin el punto de las abreviaturas. */
function chileName(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-CL', { ...options, timeZone: CHILE_TIME_ZONE })
    .format(date)
    .replace(/\./g, '');
}

/**
 * Fecha escrita con un patrón (yyyy, MM, MMM, MMMM, dd, d, EEE, EEEE, HH, mm, ss y texto
 * entre comillas simples), con la zona de Chile fija. Una fecha pura no se desplaza.
 * Devuelve null si el valor está vacío o no es una fecha.
 */
export function formatChilePattern(
  value: ChileInstant | null | undefined,
  pattern: string,
): string | null {
  const d = toFormattable(value);
  if (!d) return null;
  const p = wallPartsOf(d);
  return pattern.replace(PATTERN_TOKEN, (token, literal: string | undefined) => {
    if (literal !== undefined) return literal.replace(/''/g, "'");
    switch (token) {
      case 'yyyy':
        return String(p.year).padStart(4, '0');
      case 'MMMM':
        return chileName(d, { month: 'long' });
      case 'MMM':
        return chileName(d, { month: 'short' });
      case 'MM':
        return pad(p.month);
      case 'EEEE':
        return chileName(d, { weekday: 'long' });
      case 'EEE':
        return chileName(d, { weekday: 'short' });
      case 'dd':
        return pad(p.day);
      case 'd':
        return String(p.day);
      case 'HH':
        return pad(p.hour);
      case 'mm':
        return pad(p.minute);
      default:
        return pad(p.second);
    }
  });
}

/** Hora de pared de Chile 'HH:MM' (24 horas). "—" si el valor no es un instante. */
export function formatChileTime(value: ChileInstant | null | undefined): string {
  const d = toFormattable(value);
  if (!d) return '—';
  const p = wallPartsOf(d);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}
