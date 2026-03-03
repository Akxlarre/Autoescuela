export interface StudentDocument {
    id: number;
    enrollment_id?: number | null;
    type?: string | null;
    file_name: string;
    storage_url: string;
    status?: string | null;
    document_issue_date?: string | null;
    notes?: string | null;
    uploaded_at?: string | null;
    reviewed_by?: number | null;
    reviewed_at?: string | null;
}
