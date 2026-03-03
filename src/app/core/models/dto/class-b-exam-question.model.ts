export interface ClassBExamQuestion {
    id: number;
    exam_id: number;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d?: string | null;
    correct_option: string;
    active: boolean;
    created_at: string;
}
