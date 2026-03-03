export interface ClassBExamAttempt {
    id: number;
    exam_id: number;
    student_id: number;
    enrollment_id: number;
    started_at: string;
    submitted_at?: string | null;
    score?: number | null;
    passed?: boolean | null;
    answers?: Record<string, any> | null;
    timed_out: boolean;
    created_at: string;
}
