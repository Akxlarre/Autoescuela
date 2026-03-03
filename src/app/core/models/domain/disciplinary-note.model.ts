export interface DisciplinaryNote {
    id: number;
    student_id?: number | null;
    description: string;
    date: string;
    recorded_by?: number | null;
    created_at: string;
}
