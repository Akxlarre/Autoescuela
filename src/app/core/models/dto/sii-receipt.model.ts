export interface SiiReceipt {
    id: number;
    type: string;
    folio: number;
    amount: number;
    amount_class_b: number;
    amount_class_a: number;
    amount_sensometry: number;
    amount_other: number;
    issued_at?: string | null;
    status?: string | null;
    recipient_tax_id?: string | null;
    recipient_name?: string | null;
    branch_id?: number | null;
    created_at: string;
}
