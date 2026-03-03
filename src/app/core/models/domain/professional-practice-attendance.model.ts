export interface ProfessionalPracticeAttendance {
    id: number;
    session_id?: number | null;
    enrollment_id?: number | null;
    student_id?: number | null;
    status?: string | null;
    block_percentage: number;
    justification?: string | null;
    evidence_id?: number | null;
    recorded_by?: number | null;
    recorded_at?: string | null;
}
