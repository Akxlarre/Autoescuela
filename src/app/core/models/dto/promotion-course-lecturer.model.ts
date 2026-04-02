export interface PromotionCourseLecturer {
  id: number;
  promotion_course_id: number;
  lecturer_id: number;
  role: 'theory' | 'practice' | 'both' | null;
  created_at: string;
}
