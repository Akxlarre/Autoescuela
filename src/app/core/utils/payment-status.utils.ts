import type { AnulacionPago } from '@core/models/ui/pagos.model';
import { formatChileDate, formatChileTime } from '@core/utils/chile-time.utils';

// ─── Estado de un pago individual (`payments.status`) — spec 0025-m ──────────────────────────

/** Un pago anulado: la fila sigue existiendo, se muestra tachada y no suma en ningún total. */
export const PAYMENT_STATUS_ANULADO = 'anulado';

/**
 * Estados de `payments.status` que cuentan como plata recibida. Se define solo acá: toda lectura
 * de `payments` que sume o cuente filtra con `.in('status', [...PAYMENT_STATUSES_QUE_SUMAN])`
 * (lo verifica `payments-status-filter.guard.spec.ts`). `pending` es una deuda registrada con $0
 * recibido y `anulado` un pago que se quitó.
 */
export const PAYMENT_STATUSES_QUE_SUMAN: readonly string[] = ['paid', 'completado'];

export function paymentCuentaComoIngreso(status: string | null | undefined): boolean {
  return PAYMENT_STATUSES_QUE_SUMAN.includes(status ?? '');
}

/** Filas de `payments` ya leídas, sin las que no cuentan como ingreso. */
export function soloPagosVigentes<T extends { status?: string | null }>(rows: readonly T[]): T[] {
  return rows.filter((row) => paymentCuentaComoIngreso(row.status));
}

const PAYMENT_STATUS: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'neutral' }
> = {
  paid: { label: 'Pagado', variant: 'success' },
  completado: { label: 'Pagado', variant: 'success' },
  pending: { label: 'Pendiente', variant: 'warning' },
  [PAYMENT_STATUS_ANULADO]: { label: 'Anulado', variant: 'neutral' },
};

export function paymentStatusLabel(status: string | null | undefined): string {
  return PAYMENT_STATUS[status ?? '']?.label ?? '—';
}

export function paymentStatusVariant(
  status: string | null | undefined,
): 'success' | 'warning' | 'neutral' {
  return PAYMENT_STATUS[status ?? '']?.variant ?? 'neutral';
}

/**
 * Columnas de anulación para el `select` de una lectura que lista pagos. El join usa la columna
 * como pista porque `payments` tiene dos FK a `users` (`registered_by` y `voided_by`).
 */
export const PAYMENT_ANULACION_SELECT =
  'void_reason, voided_at, anulado_por:users!voided_by(first_names, paternal_last_name)';

interface AnuladoPorRow {
  first_names?: string | null;
  paternal_last_name?: string | null;
}

/** Fila cruda de `payments` con sus columnas de anulación. */
export interface PaymentAnulacionRow {
  status?: string | null;
  void_reason?: string | null;
  voided_at?: string | null;
  anulado_por?: AnuladoPorRow | AnuladoPorRow[] | null;
}

/**
 * Datos de anulación de un pago para la UI, o `null` si el pago está vigente. `por` queda en
 * `null` cuando quien mira no puede leer al usuario que anuló (RLS de `users` por sede).
 */
export function mapAnulacionPago(row: PaymentAnulacionRow): AnulacionPago | null {
  if (row.status !== PAYMENT_STATUS_ANULADO) return null;
  const autor = Array.isArray(row.anulado_por) ? row.anulado_por[0] : row.anulado_por;
  const por = autor
    ? `${autor.first_names ?? ''} ${autor.paternal_last_name ?? ''}`.trim() || null
    : null;
  const fecha = { day: '2-digit', month: '2-digit', year: 'numeric' } as const;
  return {
    motivo: row.void_reason?.trim() || 'Sin motivo registrado',
    por,
    cuando: row.voided_at
      ? `${formatChileDate(row.voided_at, fecha)} ${formatChileTime(row.voided_at)}`
      : '—',
  };
}

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
