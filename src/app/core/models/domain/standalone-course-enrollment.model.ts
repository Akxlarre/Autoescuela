export interface StandaloneCourseEnrollment {
    id: number;
    standalone_course_id: number;
    student_id: number;
    amount_paid: number;
    payment_status?: string | null;
    certificate_id?: number | null;
    registered_by?: number | null;
    enrolled_at: string;
}
