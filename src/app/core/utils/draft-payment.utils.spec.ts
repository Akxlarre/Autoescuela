import { describe, expect, it } from 'vitest';

import {
  discardDraftWithPaymentMessage,
  draftPaymentBadgeLabel,
  isDraftListed,
  summarizeDraftPayments,
} from './draft-payment.utils';

describe('draftPaymentBadgeLabel (fix-069-i)', () => {
  it('nombra el monto cobrado, o solo "registrado" si es un pago pendiente', () => {
    expect(draftPaymentBadgeLabel(150000)).toContain('150.000');
    expect(draftPaymentBadgeLabel(0)).toBe('Pago registrado');
  });
});

describe('discardDraftWithPaymentMessage (fix-069-i)', () => {
  it('con plata recibida nombra el monto y recuerda devolverla', () => {
    const msg = discardDraftWithPaymentMessage(150000);
    expect(msg).toContain('150.000');
    expect(msg).toContain('anulado');
    expect(msg).toContain('devolver');
  });

  it('con solo un pago pendiente no habla de plata cobrada', () => {
    const msg = discardDraftWithPaymentMessage(0);
    expect(msg).not.toContain('cobrado');
    expect(msg).toContain('anulado');
  });
});

describe('summarizeDraftPayments (fix-069-i)', () => {
  it('sin pagos: nada cobrado y nada que anular', () => {
    expect(summarizeDraftPayments([])).toEqual({ paidAmount: 0, hasLivePayment: false });
    expect(summarizeDraftPayments(null)).toEqual({ paidAmount: 0, hasLivePayment: false });
  });

  it('suma solo lo recibido; un pago pendiente no es plata cobrada pero sí hay que anularlo', () => {
    expect(
      summarizeDraftPayments([
        { total_amount: 150000, status: 'paid' },
        { total_amount: 50000, status: 'pending' },
      ]),
    ).toEqual({ paidAmount: 150000, hasLivePayment: true });
  });

  it('un pago anulado no cuenta ni pide motivo', () => {
    expect(summarizeDraftPayments([{ total_amount: 150000, status: 'anulado' }])).toEqual({
      paidAmount: 0,
      hasLivePayment: false,
    });
  });
});

describe('isDraftListed (fix-069-i)', () => {
  const now = new Date('2026-10-24T15:00:00.000Z');

  it('un borrador vigente se lista', () => {
    expect(isDraftListed('2026-10-24T20:00:00.000Z', false, now)).toBe(true);
  });

  it('un borrador vencido sin pago no se lista (lo borra la limpieza)', () => {
    expect(isDraftListed('2026-10-24T10:00:00.000Z', false, now)).toBe(false);
  });

  it('un borrador vencido con un pago vivo se sigue listando: la limpieza ya no lo toca', () => {
    expect(isDraftListed('2026-10-24T10:00:00.000Z', true, now)).toBe(true);
  });

  it('sin fecha de vencimiento se lista', () => {
    expect(isDraftListed(null, false, now)).toBe(true);
  });
});
