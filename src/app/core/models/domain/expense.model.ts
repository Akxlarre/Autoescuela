export interface Expense {
    id: number;
    branch_id?: number | null;
    category?: string | null;
    description: string;
    amount: number;
    date: string;
    receipt_url?: string | null;
    registered_by?: number | null;
    created_at: string;
}
