export interface SchoolSchedule {
    id: number;
    branch_id?: number | null;
    day_of_week?: number | null;
    opening_time?: string | null;
    closing_time?: string | null;
    active: boolean;
}
