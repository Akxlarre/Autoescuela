import { describe, it, expect } from 'vitest';
import { validateEmail, normalizeEmail } from './email.utils';

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
