import { describe, it, expect } from 'vitest';
import { isSameEmail, validateEmail, normalizeEmail } from './email.utils';

describe('validateEmail()', () => {
  it('acepta email estándar', () => {
    expect(validateEmail('usuario@dominio.cl')).toBe(true);
  });

  it('acepta email con plus sign (AC12)', () => {
    expect(validateEmail('usuario+tag@dominio.com')).toBe(true);
  });

  it('rechaza email sin TLD (AC11)', () => {
    expect(validateEmail('usuario@dominio')).toBe(false);
  });

  it('rechaza email sin arroba', () => {
    expect(validateEmail('noesunemail')).toBe(false);
  });

  it('rechaza email con espacios', () => {
    expect(validateEmail('user @domain.com')).toBe(false);
  });

  it('acepta email con subdominio', () => {
    expect(validateEmail('user@mail.empresa.cl')).toBe(true);
  });
});

describe('normalizeEmail()', () => {
  it('convierte mayúsculas a minúsculas (AC8, AC-E2)', () => {
    expect(normalizeEmail('USER@DOMAIN.COM')).toBe('user@domain.com');
  });

  it('elimina espacios perimetrales y convierte a minúsculas', () => {
    expect(normalizeEmail('  HI@X.CL  ')).toBe('hi@x.cl');
  });

  it('no modifica email ya normalizado', () => {
    expect(normalizeEmail('user@domain.com')).toBe('user@domain.com');
  });

  it('normaliza dominio con mayúsculas mixtas', () => {
    expect(normalizeEmail('User@Domain.Com')).toBe('user@domain.com');
  });
});

describe('isSameEmail() (fix-296-m)', () => {
  it('el mismo correo es igual', () => {
    expect(isSameEmail('ana@correo.cl', 'ana@correo.cl')).toBe(true);
  });

  it('mayúsculas y espacios al borde no cuentan como diferencia', () => {
    expect(isSameEmail('  Ana@Correo.CL ', 'ana@correo.cl')).toBe(true);
  });

  it('un correo distinto no es igual', () => {
    expect(isSameEmail('ana.nueva@correo.cl', 'ana@correo.cl')).toBe(false);
  });

  it('vacío, null o undefined se tratan como sin correo', () => {
    expect(isSameEmail(null, undefined)).toBe(true);
    expect(isSameEmail('', null)).toBe(true);
    expect(isSameEmail('ana@correo.cl', null)).toBe(false);
  });
});
