export interface ClassBExamScore {
    id: number;
    student_id?: number | null;
    enrollment_id?: number | null;
    date?: string | null;
    score?: number | null;
    passed?: boolean | null;
    registered_by?: number | null;
    created_at: string;
}
