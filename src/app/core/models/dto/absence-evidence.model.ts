export interface AbsenceEvidence {
    id: number;
    enrollment_id?: number | null;
    document_type?: string | null;
    description?: string | null;
    file_url: string;
    document_date?: string | null;
    status?: string | null;
    reviewed_by?: number | null;
    reviewed_at?: string | null;
    created_at: string;
}
