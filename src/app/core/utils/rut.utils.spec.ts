import { describe, it, expect } from 'vitest';
import {
  calculateRutDv,
  completeRutDv,
  formatRutTyping,
  validateRut,
  formatRut,
} from './rut.utils';

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

// fix-213-b (C05 de ASG-i-034 / ASG-b-047): el DV se completa solo si falta; nunca se reemplaza.
describe('formatRutTyping', () => {
  it('sin guion solo pone puntos al número (no inventa un DV)', () => {
    expect(formatRutTyping('11111111')).toBe('11.111.111');
    expect(formatRutTyping('1234')).toBe('1.234');
    expect(formatRutTyping('')).toBe('');
  });

  it('con guion escrito por el usuario, formatea cuerpo-DV', () => {
    expect(formatRutTyping('12345678-5')).toBe('12.345.678-5');
    expect(formatRutTyping('12.345.678-')).toBe('12.345.678-');
  });

  it('una K solo puede ser DV: la separa con guion', () => {
    expect(formatRutTyping('6k')).toBe('6-K');
  });

  it('reformatear lo ya formateado no cambia nada', () => {
    expect(formatRutTyping('11.111.111')).toBe('11.111.111');
    expect(formatRutTyping('11.111.111-1')).toBe('11.111.111-1');
  });
});

describe('completeRutDv', () => {
  it('sin guion: el número entero es el cuerpo y se le agrega el DV (lo que pidió ASG-b-047)', () => {
    expect(completeRutDv('11111111')).toBe('11.111.111-1');
    expect(completeRutDv('11.111.111')).toBe('11.111.111-1');
    expect(completeRutDv('12345678')).toBe('12.345.678-5');
    expect(completeRutDv('6')).toBe('6-K');
  });

  it('sin guion y con 9 dígitos: el último es el DV y se respeta', () => {
    expect(completeRutDv('123456785')).toBe('12.345.678-5');
    expect(completeRutDv('123456781')).toBe('12.345.678-1'); // inválido: lo marca validateRut
  });

  it('con guion: nunca reemplaza el DV escrito (un error se ve como error)', () => {
    expect(completeRutDv('12.345.678-1')).toBe('12.345.678-1');
    expect(validateRut(completeRutDv('12.345.678-1'))).toBe(false);
    expect(completeRutDv('12345678-5')).toBe('12.345.678-5');
    expect(completeRutDv('6-K')).toBe('6-K');
  });

  it('es idempotente: salir del campo dos veces no cambia nada', () => {
    expect(completeRutDv(completeRutDv('11111111'))).toBe('11.111.111-1');
  });

  it('vacío o sin número: devuelve lo mismo', () => {
    expect(completeRutDv('')).toBe('');
    expect(completeRutDv('-')).toBe('-');
  });
});

describe('formatRut (normalización para guardar — sin cambios)', () => {
  it('sigue tomando el último carácter como DV', () => {
    expect(formatRut('123456785')).toBe('12.345.678-5');
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
