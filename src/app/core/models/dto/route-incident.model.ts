export interface RouteIncident {
    id: number;
    vehicle_id?: number | null;
    instructor_id?: number | null;
    class_b_session_id?: number | null;
    occurred_at?: string | null;
    description: string;
    type?: string | null;
    evidence_url?: string | null;
    registered_by?: number | null;
    created_at: string;
}
