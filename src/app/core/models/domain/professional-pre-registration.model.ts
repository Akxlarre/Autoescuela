export interface ProfessionalPreRegistration {
    id: number;
    temp_user_id: number;
    desired_course_class: string;
    psych_test_status?: string | null;
    psych_test_result?: string | null;
    registered_at: string;
    expires_at: string;
    status?: string | null;
    converted_enrollment_id?: number | null;
}
