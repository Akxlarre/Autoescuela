export interface InstructorAdvance {
    id: number;
    instructor_id?: number | null;
    date: string;
    amount: number;
    reason?: string | null;
    description?: string | null;
    status?: string | null;
    deducted_on?: string | null;
    registered_by?: number | null;
    created_at: string;
}
