import { describe, expect, it } from 'vitest';
import {
  enrollmentPaymentStatusLabel,
  enrollmentPaymentStatusVariant,
} from './payment-status.utils';

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
