export interface ProfessionalPromotion {
    id: number;
    code?: string | null;
    name?: string | null;
    start_date: string;
    end_date?: string | null;
    max_students: number;
    status?: string | null;
    current_day: number;
    branch_id?: number | null;
    created_at: string;
}
