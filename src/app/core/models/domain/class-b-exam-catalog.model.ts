export interface ClassBExamCatalog {
    id: number;
    title: string;
    description?: string | null;
    time_limit_min: number;
    total_questions: number;
    pass_score: number;
    active: boolean;
    created_by?: number | null;
    created_at: string;
    updated_at: string;
}
