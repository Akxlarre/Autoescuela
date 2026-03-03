export interface LicenseValidation {
    id: number;
    student_id?: number | null;
    enrollment_a2_id?: number | null;
    enrollment_a4_id?: number | null;
    reduced_hours: number;
    book2_open_date?: string | null;
    history_ref_id?: number | null;
    created_at: string;
}
