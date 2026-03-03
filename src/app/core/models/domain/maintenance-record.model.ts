export interface MaintenanceRecord {
    id: number;
    vehicle_id?: number | null;
    type?: string | null;
    description: string;
    scheduled_date?: string | null;
    completed_date?: string | null;
    km_at_time?: number | null;
    workshop?: string | null;
    status?: string | null;
    cost?: number | null;
    registered_by?: number | null;
    created_at: string;
}
