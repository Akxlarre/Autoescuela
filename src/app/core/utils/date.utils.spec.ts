import { describe, expect, it } from 'vitest';
import { isoToDate, toISODate } from './date.utils';

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
