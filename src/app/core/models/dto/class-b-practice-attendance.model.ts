export interface ClassBPracticeAttendance {
    id: number;
    class_b_session_id?: number | null;
    student_id?: number | null;
    status?: string | null;
    justification?: string | null;
    evidence_url?: string | null;
    consecutive_absences: number;
    recorded_by?: number | null;
    recorded_at?: string | null;
}
