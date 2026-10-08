import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildDayLabel,
  formatChileanDate,
  formatDayMonthYear,
  isoToDate,
  monthsAgoIso,
  to24hTime,
  toISODate,
  todayIso,
} from './date.utils';

describe('formatDayMonthYear — fix-273-m', () => {
  it('formatea una fecha sin hora como dd-mm-aaaa', () => {
    expect(formatDayMonthYear('2026-09-05')).toBe('05-09-2026');
  });

  it('formatea un instante con su día de Chile, no con el día UTC', () => {
    // 23:30 hora Chile del 31 de enero = 02:30 UTC del 1 de febrero.
    expect(formatDayMonthYear('2026-02-01T02:30:00.000Z')).toBe('31-01-2026');
    expect(formatDayMonthYear('2026-01-31T12:30:00+00:00')).toBe('31-01-2026');
  });

  it.each([null, undefined, '', 'no-es-fecha'])('%s → "—"', (value) => {
    expect(formatDayMonthYear(value)).toBe('—');
  });
});

describe('hoy en Chile — spec 0024-m', () => {
  afterEach(() => vi.useRealTimers());

  it('todayIso a las 23:30 hora Chile sigue siendo hoy (UTC ya cambió de día)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T02:30:00.000Z'));
    expect(todayIso()).toBe('2026-10-06');
  });

  it('todayIso a las 15:00 hora Chile (control)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T18:00:00.000Z'));
    expect(todayIso()).toBe('2026-10-06');
  });

  it('monthsAgoIso parte del hoy de Chile', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T02:30:00.000Z'));
    expect(monthsAgoIso(3)).toBe('2026-07-06');
    expect(monthsAgoIso(0)).toBe('2026-10-06');
  });

  it('monthsAgoIso recorta al último día si el mes destino es más corto', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T15:00:00.000Z'));
    expect(monthsAgoIso(1)).toBe('2026-02-28');
  });
});

describe('toISODate', () => {
  it('un instante en string da su día de Chile', () => {
    expect(toISODate('2026-10-07T02:30:00.000Z')).toBe('2026-10-06');
  });

  it('una fecha pura se devuelve tal cual', () => {
    expect(toISODate('2026-10-06')).toBe('2026-10-06');
  });

  it('un Date se lee como fecha de calendario (selector de fechas)', () => {
    expect(toISODate(new Date(2026, 9, 6, 0, 0, 0))).toBe('2026-10-06');
  });

  it('un valor inválido da cadena vacía', () => {
    expect(toISODate('no-es-fecha')).toBe('');
  });
});

describe('to24hTime / formatChileanDate / buildDayLabel', () => {
  it('to24hTime da la hora de pared de Chile', () => {
    expect(to24hTime('2026-10-07T02:30:00.000Z')).toBe('23:30');
    expect(to24hTime('no-es-fecha')).toBe('');
  });

  it('formatChileanDate usa el día de Chile de un instante', () => {
    const opts = { day: '2-digit', month: '2-digit', year: 'numeric' } as const;
    expect(formatChileanDate('2026-10-07T02:30:00.000Z', opts)).toBe('06-10-2026');
    expect(formatChileanDate('2026-10-06', opts)).toBe('06-10-2026');
    expect(formatChileanDate(null)).toBe('—');
  });

  it('buildDayLabel no desplaza una fecha pura', () => {
    expect(buildDayLabel('2026-10-06')).toMatch(/^Mar 6 Oct$/);
    expect(buildDayLabel('no-es-fecha')).toBe('—');
  });
});

describe('isoToDate', () => {
  it('converts a valid ISO string to a Date with correct day/month/year', () => {
    const d = isoToDate('2000-03-15');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2000);
    expect(d!.getMonth()).toBe(2); // 0-indexed
    expect(d!.getDate()).toBe(15);
  });

  it('returns null for empty string', () => {
    expect(isoToDate('')).toBeNull();
  });

  it('returns null for invalid string', () => {
    expect(isoToDate('no-es-fecha')).toBeNull();
  });

  it('round-trips with toISODate', () => {
    const iso = '2000-03-15';
    expect(toISODate(isoToDate(iso)!)).toBe(iso);
  });

  it('handles edge date 1920-01-01', () => {
    const d = isoToDate('1920-01-01');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(1920);
  });
});
