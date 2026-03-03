export interface Certificate {
    id: number;
    folio: number;
    batch_id?: number | null;
    enrollment_id?: number | null;
    student_id?: number | null;
    type?: string | null;
    status?: string | null;
    qr_url?: string | null;
    issued_date?: string | null;
    issued_by?: number | null;
    created_at: string;
}
