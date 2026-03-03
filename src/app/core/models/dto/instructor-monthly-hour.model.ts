export interface InstructorMonthlyHour {
    id: number;
    instructor_id?: number | null;
    period: string;
    theory_hours: number;
    practical_sessions: number;
    total_equivalent?: number | null;
}
