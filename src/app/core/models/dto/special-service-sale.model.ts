export interface SpecialServiceSale {
    id: number;
    student_id?: number | null;
    service_id?: number | null;
    sale_date: string;
    price: number;
    metadata?: Record<string, any> | null;
    registered_by?: number | null;
    created_at: string;
}
