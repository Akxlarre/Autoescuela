import { describe, it, expect } from 'vitest';
import { validateName, stripInvalidNameChars } from './name.utils';

describe('validateName()', () => {
  describe('nombres válidos', () => {
    it('acepta nombre simple (AC14)', () => {
      expect(validateName('Juan')).toBe(true);
    });

    it('acepta nombre con tilde (AC14)', () => {
      expect(validateName('García')).toBe(true);
    });

    it('acepta nombre compuesto con guion (AC14)', () => {
      expect(validateName('García-López')).toBe(true);
    });

    it('acepta nombre con espacio interno (AC14)', () => {
      expect(validateName('María José')).toBe(true);
    });

    it('acepta nombre con apóstrofe (AC14)', () => {
      expect(validateName("O'Brien")).toBe(true);
    });

    it('acepta nombre con ñ', () => {
      expect(validateName('Muñoz')).toBe(true);
    });

    it('acepta longitud mínima de 2 caracteres válidos', () => {
      expect(validateName('Ab')).toBe(true);
    });
  });

  describe('nombres inválidos', () => {
    it('rechaza nombre con dígito (AC13)', () => {
      expect(validateName('Juan123')).toBe(false);
    });

    it('rechaza nombre con solo espacios (AC-E4)', () => {
      expect(validateName('   ')).toBe(false);
    });

    it('rechaza string vacío', () => {
      expect(validateName('')).toBe(false);
    });

    it('rechaza nombre de un solo carácter tras trim', () => {
      expect(validateName('A')).toBe(false);
    });

    it('rechaza nombre con símbolo prohibido (@)', () => {
      expect(validateName('Juan@')).toBe(false);
    });

    it('rechaza nombre con símbolo prohibido (#)', () => {
      expect(validateName('Ana#2')).toBe(false);
    });
  });
});

describe('stripInvalidNameChars()', () => {
  it('elimina dígitos dejando el resto intacto (AC13)', () => {
    expect(stripInvalidNameChars('Juan123')).toBe('Juan');
  });

  it('elimina símbolo @ pero conserva letras', () => {
    expect(stripInvalidNameChars('Juan@')).toBe('Juan');
  });

  it('conserva tildes y ñ', () => {
    expect(stripInvalidNameChars('García')).toBe('García');
  });

  it('conserva guiones y apóstrofes (AC14)', () => {
    expect(stripInvalidNameChars("García-O'Brien")).toBe("García-O'Brien");
  });

  it('conserva espacios internos', () => {
    expect(stripInvalidNameChars('María José')).toBe('María José');
  });

  it('elimina múltiples símbolos inválidos a la vez', () => {
    expect(stripInvalidNameChars('A1na!2')).toBe('Ana');
  });

  it('devuelve string vacío si todo es inválido', () => {
    expect(stripInvalidNameChars('123!@#')).toBe('');
  });
});
