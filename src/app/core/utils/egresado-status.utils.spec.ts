import { describe, it, expect } from 'vitest';
import { getEgresadoAccountStatus } from './egresado-status.utils';

describe('getEgresadoAccountStatus()', () => {
  it('retorna "Debe $X" con variant warning cuando hay saldo pendiente', () => {
    const status = getEgresadoAccountStatus(40000);
    expect(status.variant).toBe('warning');
    expect(status.label).toBe('Debe $40.000');
  });

  it('retorna "Al día" con variant success cuando el saldo es 0', () => {
    expect(getEgresadoAccountStatus(0)).toEqual({ label: 'Al día', variant: 'success' });
  });
});
