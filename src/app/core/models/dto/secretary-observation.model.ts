export interface SecretaryObservation {
    id: number;
    type: string;
    message: string;
    due_date?: string | null;
    created_by: number;
    status?: string | null;
    admin_reply?: string | null;
    seen_by?: number | null;
    seen_at?: string | null;
    created_at: string;
}
