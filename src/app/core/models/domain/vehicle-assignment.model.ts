export interface VehicleAssignment {
    id: number;
    instructor_id?: number | null;
    vehicle_id?: number | null;
    start_date: string;
    end_date?: string | null;
    assigned_by?: number | null;
    reason?: string | null;
    created_at: string;
}
