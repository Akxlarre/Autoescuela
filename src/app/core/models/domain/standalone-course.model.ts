export interface StandaloneCourse {
    id: number;
    name: string;
    type: string;
    billing_type: string;
    base_price: number;
    duration_hours: number;
    max_students: number;
    start_date: string;
    end_date?: string | null;
    status?: string | null;
    branch_id?: number | null;
    registered_by?: number | null;
    created_at: string;
}
