export interface SessionMachinery {
    id: number;
    session_id?: number | null;
    type?: string | null;
    description?: string | null;
    rental_cost?: number | null;
    created_at: string;
}
