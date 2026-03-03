export interface DigitalContract {
    id: number;
    enrollment_id: number;
    student_id?: number | null;
    content_hash?: string | null;
    signature_ip?: string | null;
    accepted_at?: string | null;
    file_name?: string | null;
    file_url?: string | null;
}
