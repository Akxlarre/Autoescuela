export interface PromotionCourse {
    id: number;
    promotion_id: number;
    course_id: number;
    lecturer_id: number;
    template_id?: number | null;
    max_students: number;
    enrolled_students: number;
    status?: string | null;
    created_at: string;
}
