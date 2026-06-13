import { describe, it, expect } from 'vitest';
import { validatePhone, normalizePhone, DIAL_CODES } from './phone.utils';

describe('validatePhone()', () => {
  describe('+56 (Chile)', () => {
    it('acepta móvil chileno — 9 dígitos comenzando con 9 (AC2)', () => {
      expect(validatePhone('912345678', '+56')).toBe(true);
    });

    it('acepta fijo chileno — 8 dígitos (AC3)', () => {
      expect(validatePhone('22345678', '+56')).toBe(true);
    });

    it('rechaza menos de 8 dígitos (AC4)', () => {
      expect(validatePhone('1234567', '+56')).toBe(false);
    });

    it('rechaza dígitos vacíos (AC-E3)', () => {
      expect(validatePhone('', '+56')).toBe(false);
    });

    it('rechaza 9 dígitos que no comiencen con 9', () => {
      expect(validatePhone('812345678', '+56')).toBe(false);
    });

    it('ignora espacios de formato al validar (AC-E6)', () => {
      expect(validatePhone('9 1234 5678', '+56')).toBe(true);
    });

    it('rechaza más de 9 dígitos', () => {
      expect(validatePhone('9123456789', '+56')).toBe(false);
    });
  });

  describe('prefijos internacionales (E.164 — AC5)', () => {
    it('acepta número argentino con 7 dígitos mínimos', () => {
      expect(validatePhone('1234567', '+54')).toBe(true);
    });

    it('acepta número con 15 dígitos (máximo E.164)', () => {
      expect(validatePhone('123456789012345', '+1')).toBe(true);
    });

    it('rechaza número con menos de 7 dígitos (internacional)', () => {
      expect(validatePhone('123456', '+54')).toBe(false);
    });

    it('rechaza número con más de 15 dígitos', () => {
      expect(validatePhone('1234567890123456', '+1')).toBe(false);
    });

    it('rechaza dígitos vacíos con prefijo internacional (AC-E3)', () => {
      expect(validatePhone('', '+1')).toBe(false);
    });

    it('ignora espacios en números internacionales', () => {
      expect(validatePhone('123 456 789', '+34')).toBe(true);
    });
  });
});

describe('normalizePhone()', () => {
  it('retorna E.164 sin espacios (AC7)', () => {
    expect(normalizePhone('912345678', '+56')).toBe('+56912345678');
  });

  it('elimina espacios de formato estándar chileno (AC-E6)', () => {
    expect(normalizePhone('9 1234 5678', '+56')).toBe('+56912345678');
  });

  it('funciona con prefijo argentino', () => {
    expect(normalizePhone('1234567', '+54')).toBe('+541234567');
  });

  it('funciona con prefijo boliviano de 3 dígitos', () => {
    expect(normalizePhone('71234567', '+591')).toBe('+59171234567');
  });

  it('elimina guiones y paréntesis', () => {
    expect(normalizePhone('(555) 123-4567', '+1')).toBe('+15551234567');
  });
});

describe('DIAL_CODES', () => {
  it('incluye Chile como primer elemento con dialCode +56', () => {
    expect(DIAL_CODES[0].dialCode).toBe('+56');
    expect(DIAL_CODES[0].countryCode).toBe('CL');
  });

  it('tiene 9 prefijos incluyendo "Otro"', () => {
    expect(DIAL_CODES).toHaveLength(9);
  });

  it('incluye Argentina (+54)', () => {
    expect(DIAL_CODES.some((d) => d.dialCode === '+54')).toBe(true);
  });

  it('el último elemento es "Otro" con dialCode vacío', () => {
    const last = DIAL_CODES[DIAL_CODES.length - 1];
    expect(last.countryCode).toBe('OTHER');
    expect(last.dialCode).toBe('');
  });
});
