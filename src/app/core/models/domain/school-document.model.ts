export interface SchoolDocument {
    id: number;
    type: string;
    file_name: string;
    storage_url: string;
    description?: string | null;
    branch_id?: number | null;
    uploaded_by?: number | null;
    created_at: string;
}
