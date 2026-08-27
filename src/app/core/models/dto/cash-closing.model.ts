export interface CashClosing {
  id: number;
  branch_id?: number | null;
  date: string;
  cash_amount: number;
  transfer_amount: number;
  card_amount: number;
  voucher_amount: number;
  total_income?: number | null;
  total_expenses?: number | null;
  /** Subtotal de egresos pagados en efectivo — lo único que baja el saldo físico (fix-226-m). Null en cierres previos al fix. */
  cash_expenses?: number | null;
  balance?: number | null;
  /** Fondo de apertura del día (spec 0012-m). Null en cierres previos. */
  opening_amount?: number | null;
  arqueo_enabled?: boolean | null;
  payments_count?: number | null;
  qty_bill_20000: number;
  qty_bill_10000: number;
  qty_bill_5000: number;
  qty_bill_2000: number;
  qty_bill_1000: number;
  qty_coin_500: number;
  qty_coin_100: number;
  qty_coin_50: number;
  qty_coin_10: number;
  arqueo_amount?: number | null;
  difference?: number | null;
  status: string;
  closed: boolean;
  closed_by?: number | null;
  closed_at?: string | null;
  notes?: string | null;
}
