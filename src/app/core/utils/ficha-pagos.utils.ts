/**
 * La ficha ofrece "Registrar pago" solo si la matrícula tiene saldo pendiente (fix-278-m): el
 * formulario de pago rechaza cualquier monto mayor al saldo, así que sin saldo no hay nada que
 * registrar.
 */
/** Códigos internos de `payments.type` (los escriben el wizard de matrícula y el pago online). */
const PAYMENT_TYPE_LABELS: Record<string, string> = {
  enrollment: 'Matrícula',
  online: 'Pago Online',
  presential: 'Pago Presencial',
  installment: 'Cuota',
  partial: 'Pago Parcial',
  cash: 'Pago en Efectivo',
  transfer: 'Transferencia',
  card: 'Pago con Tarjeta',
};

/**
 * Concepto de un pago para mostrarlo en la ficha (fix-315-m). `payments.type` guarda dos cosas
 * distintas según quién creó el pago: un código interno (se traduce) o el concepto ya en español
 * que eligió el usuario en "Registrar pago" ("Abono", "Pago Total"…), que se muestra tal cual.
 * Solo un pago sin concepto se numera, con su posición en la lista (`position`, desde 1).
 */
export function formatPaymentConcept(type: string | null | undefined, position: number): string {
  const concept = type?.trim() ?? '';
  if (!concept) return `Pago #${position}`;
  return PAYMENT_TYPE_LABELS[concept.toLowerCase()] ?? concept;
}

export function canRegistrarPago(saldoPendiente: number | null | undefined): boolean {
  return (saldoPendiente ?? 0) > 0;
}
