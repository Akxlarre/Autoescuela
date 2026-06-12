import { describe, it, expect } from 'vitest';
import { calcAge, isMinor, getAgeStatus } from './age.utils';

function buildBirthDate(yearsAgo: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsAgo);
  return d.toISOString().split('T')[0];
}

describe('calcAge()', () => {
  it('retorna null con fecha vacía', () => {
    expect(calcAge('')).toBeNull();
  });

  it('retorna null con undefined', () => {
    expect(calcAge(undefined)).toBeNull();
  });

  it('retorna null con fecha inválida', () => {
    expect(calcAge('no-es-fecha')).toBeNull();
  });

  it('retorna la edad correcta en años completos', () => {
    expect(calcAge(buildBirthDate(20))).toBe(20);
  });
});

describe('isMinor()', () => {
  it('retorna true para un alumno de 17 años', () => {
    expect(isMinor(buildBirthDate(17))).toBe(true);
  });

  it('retorna false para un alumno de 18 años', () => {
    expect(isMinor(buildBirthDate(18))).toBe(false);
  });

  it('retorna false para fecha vacía', () => {
    expect(isMinor('')).toBe(false);
  });
});

describe('getAgeStatus()', () => {
  it('retorna "none" con fecha vacía', () => {
    expect(getAgeStatus('', 'class_b')).toBe('none');
  });

  it('retorna "under-17" con alumno de 15 años', () => {
    expect(getAgeStatus(buildBirthDate(15), 'class_b')).toBe('under-17');
  });

  it('retorna "requires-authorization" con alumno de 17 años en class_b (fix-013)', () => {
    expect(getAgeStatus(buildBirthDate(17), 'class_b')).toBe('requires-authorization');
  });

  it('retorna "ok" con alumno de 18 años en class_b', () => {
    expect(getAgeStatus(buildBirthDate(18), 'class_b')).toBe('ok');
  });

  it('retorna "under-20-professional" con alumno de 17 años en profesional — NO requires-authorization (fix-013/fix-014)', () => {
    expect(getAgeStatus(buildBirthDate(17), 'professional_a2')).toBe('under-20-professional');
  });

  it('retorna "under-20-professional" con alumno de 19 años en profesional', () => {
    expect(getAgeStatus(buildBirthDate(19), 'professional_a3')).toBe('under-20-professional');
  });

  it('retorna "ok" con alumno de 20 años en profesional', () => {
    expect(getAgeStatus(buildBirthDate(20), 'professional_a4')).toBe('ok');
  });

  it('aplica el check profesional a todos los subtipos (a2, a3, a4, a5)', () => {
    for (const type of [
      'professional_a2',
      'professional_a3',
      'professional_a4',
      'professional_a5',
    ]) {
      expect(getAgeStatus(buildBirthDate(19), type)).toBe('under-20-professional');
    }
  });
});
