import { describe, expect, it } from 'vitest';
import {
  enrollmentPaymentStatusLabel,
  enrollmentPaymentStatusVariant,
  mapAnulacionPago,
  paymentCuentaComoIngreso,
  paymentStatusLabel,
  paymentStatusVariant,
  PAYMENT_STATUS_ANULADO,
  PAYMENT_STATUSES_QUE_SUMAN,
  soloPagosVigentes,
} from './payment-status.utils';

describe('estado de un pago individual — spec 0025-m', () => {
  it.each([
    ['paid', true],
    ['completado', true],
    ['anulado', false],
    ['pending', false],
    [null, false],
    [undefined, false],
    ['algo_nuevo', false],
  ])('%s suma como ingreso: %s', (status, expected) => {
    expect(paymentCuentaComoIngreso(status)).toBe(expected);
  });

  it('los estados que suman no incluyen al anulado', () => {
    expect(PAYMENT_STATUSES_QUE_SUMAN).toEqual(['paid', 'completado']);
    expect(PAYMENT_STATUSES_QUE_SUMAN).not.toContain(PAYMENT_STATUS_ANULADO);
  });

  it('soloPagosVigentes deja fuera anulados y pendientes', () => {
    const rows = [
      { status: 'paid', total_amount: 100 },
      { status: 'anulado', total_amount: 900 },
      { status: 'pending', total_amount: 50 },
      { status: 'completado', total_amount: 10 },
    ];
    expect(soloPagosVigentes(rows).map((r) => r.total_amount)).toEqual([100, 10]);
  });

  it.each([
    ['paid', 'Pagado', 'success'],
    ['completado', 'Pagado', 'success'],
    ['pending', 'Pendiente', 'warning'],
    ['anulado', 'Anulado', 'neutral'],
  ])('%s → "%s" (%s)', (status, label, variant) => {
    expect(paymentStatusLabel(status)).toBe(label);
    expect(paymentStatusVariant(status)).toBe(variant);
  });

  it('un estado desconocido nunca se muestra crudo', () => {
    expect(paymentStatusLabel('algo_nuevo')).toBe('—');
    expect(paymentStatusVariant(null)).toBe('neutral');
  });
});

describe('mapAnulacionPago — spec 0025-m', () => {
  it('un pago vigente no tiene anulación', () => {
    expect(mapAnulacionPago({ status: 'paid', void_reason: null, voided_at: null })).toBeNull();
  });

  it('arma motivo, quién y cuándo (hora de Chile) de un pago anulado', () => {
    // 02:30 UTC del 14 = 23:30 del 13 en Chile.
    expect(
      mapAnulacionPago({
        status: 'anulado',
        void_reason: 'Monto mal digitado',
        voided_at: '2026-10-14T02:30:00.000Z',
        anulado_por: { first_names: 'Ana María', paternal_last_name: 'Rojas' },
      }),
    ).toEqual({ motivo: 'Monto mal digitado', por: 'Ana María Rojas', cuando: '13-10-2026 23:30' });
  });

  it('acepta el join como arreglo y tolera que no se pueda leer quién anuló', () => {
    expect(
      mapAnulacionPago({
        status: 'anulado',
        void_reason: 'x',
        voided_at: '2026-10-14T02:30:00.000Z',
        anulado_por: [{ first_names: 'Ana', paternal_last_name: 'Rojas' }],
      })?.por,
    ).toBe('Ana Rojas');
    expect(
      mapAnulacionPago({
        status: 'anulado',
        void_reason: null,
        voided_at: null,
        anulado_por: null,
      }),
    ).toEqual({ motivo: 'Sin motivo registrado', por: null, cuando: '—' });
  });
});

describe('estado de pago de una matrícula — hotfix-127-m', () => {
  it.each([
    ['paid_full', 'Pagado', 'success'],
    ['paid', 'Pagado', 'success'],
    ['partial', 'Parcial', 'warning'],
    ['pending', 'Pendiente', 'neutral'],
  ])('%s → "%s" (%s)', (status, label, variant) => {
    expect(enrollmentPaymentStatusLabel(status)).toBe(label);
    expect(enrollmentPaymentStatusVariant(status)).toBe(variant);
  });

  it.each([null, undefined, '', 'algo_nuevo'])(
    'un valor desconocido (%s) nunca se muestra crudo',
    (status) => {
      expect(enrollmentPaymentStatusLabel(status)).toBe('—');
      expect(enrollmentPaymentStatusVariant(status)).toBe('neutral');
    },
  );
});
