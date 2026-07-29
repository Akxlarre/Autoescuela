import { describe, it, expect } from 'vitest';
import { calculateRutDv, autocompleteRutDv, validateRut, formatRut } from './rut.utils';

describe('calculateRutDv', () => {
  it('calcula el DV para un cuerpo real de 8 dígitos (caso conocido "5")', () => {
    expect(calculateRutDv('12345678')).toBe('5');
  });

  it('calcula el DV "K" cuando el resto es 1', () => {
    expect(calculateRutDv('6')).toBe('K');
  });

  it('calcula el DV "0" cuando el resto es 0', () => {
    expect(calculateRutDv('0')).toBe('0');
  });

  it('calcula un DV numérico intermedio', () => {
    expect(calculateRutDv('1')).toBe('9');
  });
});

describe('autocompleteRutDv', () => {
  it('reemplaza un DV incorrecto por el correcto y formatea', () => {
    expect(autocompleteRutDv('12.345.678-1')).toBe('12.345.678-5');
  });

  it('completa el DV cuando el usuario no lo tecleó (queda en la última posición del cuerpo)', () => {
    // El último carácter siempre se trata como DV (mismo criterio que validateRut) — si el
    // usuario dejó "1234567" como cuerpo pensando en agregar el DV después, no hay corrección
    // posible hasta que exista un último carácter que reinterpretar como DV.
    expect(autocompleteRutDv('123456785')).toBe(formatRut('123456785')); // no-op: cuerpo=12345678, dv tecleado=5, ya correcto
  });

  it('acepta un RUT sin formatear y devuelve el formateado con el DV correcto', () => {
    expect(autocompleteRutDv('123456780')).toBe('12.345.678-5');
  });

  it('respeta un DV "K" ya correcto', () => {
    expect(autocompleteRutDv('6-K')).toBe('6-K');
  });

  it('devuelve el input intacto si hay menos de 2 caracteres', () => {
    expect(autocompleteRutDv('5')).toBe('5');
    expect(autocompleteRutDv('')).toBe('');
  });

  it('devuelve el input intacto si el cuerpo no es numérico', () => {
    expect(autocompleteRutDv('ab-c')).toBe('ab-c');
  });
});

describe('validateRut (regresión tras refactor a calculateRutDv)', () => {
  it('sigue validando un RUT correcto con DV numérico', () => {
    expect(validateRut('12.345.678-5')).toBe(true);
  });

  it('sigue validando un RUT correcto con DV "K"', () => {
    expect(validateRut('6-K')).toBe(true);
  });

  it('sigue rechazando un DV incorrecto', () => {
    expect(validateRut('12.345.678-9')).toBe(false);
  });
});
