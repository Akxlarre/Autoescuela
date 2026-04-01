export interface PromotionCourse {
  id: number;
  promotion_id: number;
  course_id: number;
  code?: string | null;
  max_students: number;
  status?: string | null;
  created_at: string;
}
