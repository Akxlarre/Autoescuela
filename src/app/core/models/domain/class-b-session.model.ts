export interface ClassBSession {
    id: number;
    enrollment_id?: number | null;
    instructor_id?: number | null;
    vehicle_id: number;
    class_number?: number | null;
    scheduled_at?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    duration_min: number;
    status?: string | null;
    counts_as_taken: boolean;
    cancelled_at?: string | null;
    completed_at?: string | null;
    evaluation_grade?: number | null;
    performance_notes?: string | null;
    km_start?: number | null;
    km_end?: number | null;
    gps_start?: [number, number] | string | null;
    gps_end?: [number, number] | string | null;
    notes?: string | null;
    student_signature: boolean;
    instructor_signature: boolean;
    signature_timestamp?: string | null;
    original_instructor_id?: number | null;
    registered_by?: number | null;
    created_at: string;
    updated_at: string;
}
