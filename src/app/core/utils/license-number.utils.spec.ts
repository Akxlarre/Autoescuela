import { describe, expect, it } from 'vitest';
import { isValidLicenseNumber } from './license-number.utils';

// fix-211-b (S20 de ASG-i-034): número de licencia obligatorio al crear y editar.
describe('isValidLicenseNumber', () => {
  it('acepta 3 o más caracteres (sin contar espacios a los lados)', () => {
    expect(isValidLicenseNumber('15234567')).toBe(true);
    expect(isValidLicenseNumber('  ABC  ')).toBe(true);
  });

  it('rechaza vacío, solo espacios, null o menos de 3 caracteres', () => {
    expect(isValidLicenseNumber('')).toBe(false);
    expect(isValidLicenseNumber('   ')).toBe(false);
    expect(isValidLicenseNumber(null)).toBe(false);
    expect(isValidLicenseNumber(' 12 ')).toBe(false);
  });
});
