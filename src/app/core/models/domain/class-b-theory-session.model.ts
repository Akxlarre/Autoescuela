export interface ClassBTheorySession {
    id: number;
    branch_id?: number | null;
    instructor_id?: number | null;
    scheduled_at: string;
    start_time?: string | null;
    end_time?: string | null;
    duration_min: number;
    topic?: string | null;
    zoom_link?: string | null;
    status?: string | null;
    notes?: string | null;
    registered_by?: number | null;
    created_at: string;
}
