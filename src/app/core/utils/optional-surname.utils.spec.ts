import { describe, expect, it } from 'vitest';
import { isOptionalSurnameValid } from './optional-surname.utils';

// fix-204-b (S12 de ASG-i-034): el apellido materno pasa a ser opcional.
describe('isOptionalSurnameValid', () => {
  it('vacío o solo espacios → válido (persona sin segundo apellido)', () => {
    expect(isOptionalSurnameValid('')).toBe(true);
    expect(isOptionalSurnameValid('   ')).toBe(true);
    expect(isOptionalSurnameValid(null)).toBe(true);
  });

  it('si se escribe, al menos 2 caracteres', () => {
    expect(isOptionalSurnameValid('A')).toBe(false);
    expect(isOptionalSurnameValid('Ña')).toBe(true);
    expect(isOptionalSurnameValid(' Soto ')).toBe(true);
  });
});
