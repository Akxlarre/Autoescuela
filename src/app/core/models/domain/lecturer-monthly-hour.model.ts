export interface LecturerMonthlyHour {
    id: number;
    lecturer_id?: number | null;
    period: string;
    theory_hours: number;
    practical_hours: number;
    total_hours?: number | null;
}
