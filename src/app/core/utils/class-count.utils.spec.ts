import { describe, expect, it } from 'vitest';
import { classCountFromPracticalHours } from './class-count.utils';

describe('classCountFromPracticalHours', () => {
  it('convierte 9.0 horas (Clase B estándar) a 12 clases de 45 min', () => {
    expect(classCountFromPracticalHours(9.0)).toBe(12);
  });

  it('convierte 4.5 horas (Refuerzo Clase B) a 6 clases de 45 min', () => {
    expect(classCountFromPracticalHours(4.5)).toBe(6);
  });

  it('redondea cuando las horas no calzan exacto con sesiones de 45 min', () => {
    // 5 horas = 300 min / 45 = 6.666... → redondea a 7
    expect(classCountFromPracticalHours(5)).toBe(7);
  });

  it('retorna 0 para null', () => {
    expect(classCountFromPracticalHours(null)).toBe(0);
  });

  it('retorna 0 para 0 horas', () => {
    expect(classCountFromPracticalHours(0)).toBe(0);
  });

  it('acepta un sessionMinutes distinto al default de 45', () => {
    expect(classCountFromPracticalHours(60, 30)).toBe(120);
  });
});
