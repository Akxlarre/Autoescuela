export interface DiscountApplication {
    id: number;
    discount_id?: number | null;
    enrollment_id?: number | null;
    discount_amount: number;
    applied_by?: number | null;
    applied_at?: string | null;
}
