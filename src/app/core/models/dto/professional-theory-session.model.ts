export interface ProfessionalTheorySession {
    id: number;
    promotion_course_id: number;
    date: string;
    start_time?: string | null;
    end_time?: string | null;
    status?: string | null;
    zoom_link?: string | null;
    notes?: string | null;
    registered_by?: number | null;
    created_at: string;
}
