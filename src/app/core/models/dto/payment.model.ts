export interface Payment {
  id: number;
  enrollment_id?: number | null;
  type?: string | null;
  document_number?: string | null;
  total_amount: number;
  cash_amount: number;
  transfer_amount: number;
  card_amount: number;
  voucher_amount: number;
  status?: string | null;
  payment_date?: string | null;
  receipt_url?: string | null;
  requires_receipt: boolean;
  receipt_id?: number | null;
  registered_by?: number | null;
  created_at: string;
  /** Anulación (spec 0025-m): las fija el trigger guard_anulacion_pago, no el cliente. */
  voided_at?: string | null;
  voided_by?: number | null;
  void_reason?: string | null;
}
