export interface ClassBook {
    id: number;
    branch_id?: number | null;
    promotion_course_id: number;
    period: string;
    pdf_url?: string | null;
    generated_by?: number | null;
    generated_at?: string | null;
    status?: string | null;
    closes_at?: string | null;
    closed_at?: string | null;
    closed_by?: number | null;
    created_at: string;
    updated_at: string;
}
