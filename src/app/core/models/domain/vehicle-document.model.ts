export interface VehicleDocument {
    id: number;
    vehicle_id?: number | null;
    type?: string | null;
    issue_date?: string | null;
    expiry_date: string;
    status?: string | null;
    file_url?: string | null;
    created_at: string;
}
