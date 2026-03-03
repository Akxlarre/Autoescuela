export interface ProfessionalTheoryAttendance {
    id: number;
    theory_session_prof_id?: number | null;
    enrollment_id?: number | null;
    student_id?: number | null;
    status?: string | null;
    justification?: string | null;
    evidence_id?: number | null;
    recorded_by?: number | null;
    recorded_at?: string | null;
}
