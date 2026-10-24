import { formatCLP } from './date.utils';
import { PAYMENT_STATUS_ANULADO, paymentCuentaComoIngreso } from './payment-status.utils';

/** Pagos de un borrador de matrícula, como los trae el embed `payments(total_amount, status)`. */
export interface DraftPaymentRow {
  total_amount: number | null;
  status: string | null;
}

export interface DraftPaymentSummary {
  /** Plata recibida (pagos que cuentan como ingreso). Es lo que se avisa en la lista. */
  paidAmount: number;
  /** Hay un pago no anulado (cobrado o pendiente): descartar el borrador lo anula y pide motivo. */
  hasLivePayment: boolean;
}

/**
 * fix-069-i: resume los pagos de un borrador para la lista de "Matrículas en progreso" y para
 * decidir si "Descartar" pide motivo.
 */
export function summarizeDraftPayments(
  payments: readonly DraftPaymentRow[] | null | undefined,
): DraftPaymentSummary {
  const rows = payments ?? [];
  return {
    paidAmount: rows
      .filter((p) => paymentCuentaComoIngreso(p.status))
      .reduce((sum, p) => sum + (p.total_amount ?? 0), 0),
    hasLivePayment: rows.some((p) => p.status !== PAYMENT_STATUS_ANULADO),
  };
}

/** fix-069-i: etiqueta de la tarjeta de un borrador con un pago vivo. */
export function draftPaymentBadgeLabel(paidAmount: number): string {
  return paidAmount > 0 ? `Pago cobrado ${formatCLP(paidAmount)}` : 'Pago registrado';
}

/** fix-069-i: texto del diálogo de "Descartar" cuando el borrador tiene un pago vivo. */
export function discardDraftWithPaymentMessage(paidAmount: number): string {
  const pago =
    paidAmount > 0
      ? `Esta matrícula tiene un pago cobrado de ${formatCLP(paidAmount)}.`
      : 'Esta matrícula tiene un pago registrado.';
  return (
    `${pago} Al descartarla, el pago queda anulado con el motivo que escribas y la matrícula ` +
    'queda cancelada en el historial (no se borra). Si recibiste dinero, recuerda devolverlo.'
  );
}

/**
 * fix-069-i: un borrador vencido con un pago vivo se sigue mostrando. `cleanup_expired_drafts()`
 * ya no lo borra; si la lista lo escondiera, la plata quedaría en un borrador que nadie ve.
 */
export function isDraftListed(
  expiresAt: string | null | undefined,
  hasLivePayment: boolean,
  now: Date,
): boolean {
  if (hasLivePayment || !expiresAt) return true;
  return new Date(expiresAt).getTime() > now.getTime();
}
