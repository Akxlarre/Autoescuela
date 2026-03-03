export interface AuditLog {
    id: number;
    user_id?: number | null;
    action: string;
    entity?: string | null;
    entity_id?: number | null;
    detail?: string | null;
    ip?: string | null;
    created_at: string;
}
