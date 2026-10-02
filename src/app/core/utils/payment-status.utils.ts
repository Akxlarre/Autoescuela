/**
 * Estado de pago de una matrícula (`enrollments.payment_status`) para mostrar en pantalla.
 *
 * El valor de una matrícula pagada completa es `paid_full` (lo escribe el trigger
 * `recalculate_enrollment_balance()`); `paid` es el estado de un pago individual, y se acepta
 * acá por las filas antiguas que lo traen. Un valor desconocido nunca se muestra crudo
 * (hotfix-127-m).
 */
const ENROLLMENT_PAYMENT_STATUS: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'neutral' }
> = {
  paid_full: { label: 'Pagado', variant: 'success' },
  paid: { label: 'Pagado', variant: 'success' },
  partial: { label: 'Parcial', variant: 'warning' },
  pending: { label: 'Pendiente', variant: 'neutral' },
};

export function enrollmentPaymentStatusLabel(status: string | null | undefined): string {
  return ENROLLMENT_PAYMENT_STATUS[status ?? '']?.label ?? '—';
}

export function enrollmentPaymentStatusVariant(
  status: string | null | undefined,
): 'success' | 'warning' | 'neutral' {
  return ENROLLMENT_PAYMENT_STATUS[status ?? '']?.variant ?? 'neutral';
}
