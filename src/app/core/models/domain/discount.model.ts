export interface Discount {
    id: number;
    name: string;
    discount_type?: string | null;
    value: number;
    valid_from: string;
    valid_until?: string | null;
    applicable_to?: string | null;
    status?: string | null;
    referral_code?: string | null;
    created_by?: number | null;
    created_at: string;
}
