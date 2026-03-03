export interface ProfessionalFinalRecord {
    id: number;
    enrollment_id: number;
    result: string;
    final_grade?: number | null;
    practical_exam_passed?: boolean | null;
    theory_attendance_pct?: number | null;
    practical_attendance_pct?: number | null;
    notes?: string | null;
    record_date: string;
    registered_by?: number | null;
    created_at: string;
}
