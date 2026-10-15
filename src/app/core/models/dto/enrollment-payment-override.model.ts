/**
 * Mapea `enrollment_payment_overrides` (spec 0010-i): habilitación sin pago con motivo.
 * Solo inserción. `pending_at_override` lo fija la BD (trigger), no el cliente.
 */
export type EnrollmentPaymentOverrideKind = 'clases' | 'certificado';

export interface EnrollmentPaymentOverride {
  id: number;
  enrollment_id: number;
  kind: EnrollmentPaymentOverrideKind;
  reason: string;
  pending_at_override: number;
  created_by: number;
  created_at: string;
}
