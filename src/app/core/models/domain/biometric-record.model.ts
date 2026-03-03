export interface BiometricRecord {
    id: number;
    student_id?: number | null;
    class_b_session_id?: number | null;
    professional_session_id?: number | null;
    event_type?: string | null;
    method?: string | null;
    gps?: [number, number] | string | null;
    timestamp: string;
    created_at: string;
}
