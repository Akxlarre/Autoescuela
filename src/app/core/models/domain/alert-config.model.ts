export interface AlertConfig {
    id: number;
    alert_type: string;
    advance_days: number;
    active: boolean;
    branch_id?: number | null;
}
