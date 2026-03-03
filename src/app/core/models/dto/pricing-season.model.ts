export interface PricingSeason {
    id: number;
    name?: string | null;
    price_class_b?: number | null;
    price_a2?: number | null;
    start_date?: string | null;
    end_date?: string | null;
    active: boolean;
    created_by?: number | null;
    created_at: string;
}
