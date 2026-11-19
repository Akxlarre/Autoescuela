import { describe, expect, it } from 'vitest';
import { formatPayrollHours, roundPayrollHours, sumPayrollHours } from './payroll-hours.utils';

/** spec 0012-i AC17: horas exactas (0,75 por clase), dos decimales. */
describe('payroll-hours.utils (spec 0012-i AC17)', () => {
  it('roundPayrollHours conserva 2,25 (no la sube a 2,3)', () => {
    expect(roundPayrollHours(3 * 0.75)).toBe(2.25);
  });

  it('roundPayrollHours limpia la deriva de punto flotante a 2 decimales', () => {
    expect(roundPayrollHours(0.1 + 0.2)).toBe(0.3);
    expect(roundPayrollHours(0)).toBe(0);
  });

  it('sumPayrollHours suma exacto: 2,25 + 2,25 + 2,25 + 3 = 9,75', () => {
    expect(
      sumPayrollHours([
        { totalHours: 2.25 },
        { totalHours: 2.25 },
        { totalHours: 2.25 },
        { totalHours: 3 },
      ]),
    ).toBe(9.75);
    expect(sumPayrollHours([])).toBe(0);
  });

  it('formatPayrollHours muestra siempre dos decimales con coma', () => {
    expect(formatPayrollHours(2.25)).toBe('2,25');
    expect(formatPayrollHours(3)).toBe('3,00');
    expect(formatPayrollHours(0.75)).toBe('0,75');
    expect(formatPayrollHours(0)).toBe('0,00');
  });
});
