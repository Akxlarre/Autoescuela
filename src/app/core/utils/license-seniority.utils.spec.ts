import { describe, it, expect } from 'vitest';
import { calcLicenseSeniority } from './license-seniority.utils';

describe('calcLicenseSeniority()', () => {
  it('retorna válido sin mensaje si falta la fecha de licencia', () => {
    expect(calcLicenseSeniority(null, '2026-08-10')).toEqual({
      valid: true,
      message: '',
      seniorityYears: null,
    });
  });

  it('retorna válido sin mensaje si falta la fecha de inicio del curso', () => {
    expect(calcLicenseSeniority('2024-01-01', null)).toEqual({
      valid: true,
      message: '',
      seniorityYears: null,
    });
  });

  it('retorna válido cuando la licencia cumple exactamente 2 años a la fecha de inicio', () => {
    const result = calcLicenseSeniority('2024-08-10', '2026-08-10');
    expect(result.valid).toBe(true);
    expect(result.seniorityYears).toBeCloseTo(2, 1);
  });

  it('retorna válido cuando la licencia supera los 2 años a la fecha de inicio', () => {
    const result = calcLicenseSeniority('2020-01-01', '2026-08-10');
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });

  it('retorna inválido con mensaje cuando faltan meses para los 2 años', () => {
    // Curso empieza 2026-08-10, licencia obtenida 2025-06-10 → faltan ~10 meses
    const result = calcLicenseSeniority('2025-06-10', '2026-08-10');
    expect(result.valid).toBe(false);
    expect(result.seniorityYears).toBeCloseTo(1.17, 1);
    expect(result.message).toContain('2 años');
    expect(result.message).toMatch(/mes/);
  });

  it('cuando faltan pocos días, el mensaje los muestra en días (no los infla a "1 mes")', () => {
    // Curso empieza 2026-08-10; se cumplen los 2 años recién el 2026-08-13 → faltan 3 días
    const result = calcLicenseSeniority('2024-08-13', '2026-08-10');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('3 días');
    expect(result.message).not.toContain('mes');
  });

  it('concuerda el verbo con la cantidad: singular "falta 1 día", plural "faltan N días/meses"', () => {
    // Exactamente 1 día de diferencia → singular
    const single = calcLicenseSeniority('2024-08-11', '2026-08-10');
    expect(single.message).toContain('falta 1 día');
    expect(single.message).not.toContain('faltan 1 día');

    // Varios días → plural
    const plural = calcLicenseSeniority('2024-08-15', '2026-08-10');
    expect(plural.message).toContain('faltan 5 días');
  });

  it('el mensaje nombra la fecha de referencia usada, para no ambigüar según dónde se muestre', () => {
    // Debe funcionar igual de bien si la referencia es "hoy" (advertencia temprana, Step 1)
    // que si es la fecha de inicio de una promoción (chequeo definitivo, Step 2).
    const result = calcLicenseSeniority('2025-06-10', '2026-08-10');
    expect(result.message).toContain('10 ago 2026');
  });

  it('retorna inválido cuando la licencia es del mismo día de inicio del curso', () => {
    const result = calcLicenseSeniority('2026-08-10', '2026-08-10');
    expect(result.valid).toBe(false);
    expect(result.seniorityYears).toBeCloseTo(0, 1);
  });

  it('retorna válido sin mensaje con fechas inválidas', () => {
    expect(calcLicenseSeniority('no-es-fecha', '2026-08-10')).toEqual({
      valid: true,
      message: '',
      seniorityYears: null,
    });
  });
});
