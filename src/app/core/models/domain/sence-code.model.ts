export interface SenceCode {
    id: number;
    code: string;
    description?: string | null;
    course_id?: number | null;
    valid: boolean;
    start_date?: string | null;
    end_date?: string | null;
}
