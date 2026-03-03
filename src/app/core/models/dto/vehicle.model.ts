export interface Vehicle {
    id: number;
    license_plate: string;
    brand: string;
    model: string;
    year: number;
    body_type?: string | null;
    transmission?: string | null;
    branch_id?: number | null;
    status?: string | null;
    current_km: number;
    last_inspection?: string | null;
    last_maintenance?: string | null;
    created_at: string;
}
