export interface ProfessionalPracticeSession {
    id: number;
    promotion_course_id: number;
    date: string;
    start_time?: string | null;
    end_time?: string | null;
    status?: string | null;
    notes?: string | null;
    registered_by?: number | null;
    created_at: string;
}
