import { describe, expect, it } from 'vitest';
import { canRegistrarPago, formatPaymentConcept } from './ficha-pagos.utils';

describe('formatPaymentConcept (fix-315-m)', () => {
  it.each([
    ['enrollment', 'Matrícula'],
    ['online', 'Pago Online'],
    ['  Installment ', 'Cuota'],
  ])('traduce el código interno %s', (type, esperado) => {
    expect(formatPaymentConcept(type, 1)).toBe(esperado);
  });

  it.each(['Abono', 'Segunda Cuota (Clases 7-12)', 'Pago Total', 'Otro', 'Matrícula'])(
    'muestra tal cual el concepto que guarda "Registrar pago": %s',
    (type) => {
      expect(formatPaymentConcept(type, 3)).toBe(type);
    },
  );

  it.each([null, undefined, '', '   '])('sin concepto (%s) numera el pago', (type) => {
    expect(formatPaymentConcept(type, 2)).toBe('Pago #2');
  });
});

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
