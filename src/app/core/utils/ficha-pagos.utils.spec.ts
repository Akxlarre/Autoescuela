import { describe, expect, it } from 'vitest';
import { canRegistrarPago } from './ficha-pagos.utils';

describe('canRegistrarPago() — fix-278-m', () => {
  it('con saldo pendiente se puede registrar un pago desde la ficha', () => {
    expect(canRegistrarPago(90000)).toBe(true);
  });

  it.each([0, -1, null, undefined])(
    'sin saldo pendiente (%s) no: el formulario rechaza montos mayores al saldo',
    (saldo) => {
      expect(canRegistrarPago(saldo)).toBe(false);
    },
  );
});
