export interface InstructorReplacement {
    id: number;
    absent_instructor_id?: number | null;
    replacement_instructor_id?: number | null;
    date: string;
    reason: string;
    affected_classes?: number[] | null;
    registered_by?: number | null;
    created_at: string;
}
