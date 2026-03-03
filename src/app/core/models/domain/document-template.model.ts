export interface DocumentTemplate {
    id: number;
    name: string;
    description?: string | null;
    category: string;
    format: string;
    version?: string | null;
    file_url: string;
    download_count: number;
    active: boolean;
    updated_by?: number | null;
    created_at: string;
    updated_at: string;
}
