import { describe, expect, it } from 'vitest';
import { isValidHourlyRate } from './hourly-rate.utils';

// fix-210-b (S22 de ASG-i-034): la columna es INTEGER y una tarifa 0 deja la liquidación en $0.
describe('isValidHourlyRate', () => {
  it('acepta enteros mayores a 0', () => {
    expect(isValidHourlyRate(1)).toBe(true);
    expect(isValidHourlyRate(5000)).toBe(true);
  });

  it('rechaza decimales, 0, negativos y vacío', () => {
    expect(isValidHourlyRate(5000.5)).toBe(false);
    expect(isValidHourlyRate(0)).toBe(false);
    expect(isValidHourlyRate(-100)).toBe(false);
    expect(isValidHourlyRate(null)).toBe(false);
    expect(isValidHourlyRate(Number.NaN)).toBe(false);
  });
});
