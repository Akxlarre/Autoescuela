import { describe, expect, it } from 'vitest';
import { formatDayMonthYear, isoToDate, monthsAgoIso, toISODate, todayIso } from './date.utils';

describe('formatDayMonthYear — fix-273-m', () => {
  it('formatea una fecha sin hora como dd-mm-aaaa', () => {
    expect(formatDayMonthYear('2026-09-05')).toBe('05-09-2026');
  });

  it('formatea un timestamp con el día de la hora local', () => {
    const local = new Date(2026, 0, 31, 9, 30);
    expect(formatDayMonthYear(local.toISOString())).toBe('31-01-2026');
  });

  it.each([null, undefined, '', 'no-es-fecha'])('%s → "—"', (value) => {
    expect(formatDayMonthYear(value)).toBe('—');
  });
});

describe('monthsAgoIso', () => {
  it('returns a date exactly N months before today', () => {
    const expected = new Date();
    expected.setMonth(expected.getMonth() - 3);
    const expectedIso = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`;

    expect(monthsAgoIso(3)).toBe(expectedIso);
  });

  it('returns todayIso() when months is 0', () => {
    expect(monthsAgoIso(0)).toBe(todayIso());
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
