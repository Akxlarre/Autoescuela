/** DTO que mapea exactamente la tabla `professional_module_grades` */
export interface ProfessionalModuleGrade {
  id: number;
  enrollment_id: number;
  module_number: number; // 1–7
  module: string; // nombre descriptivo del módulo
  grade: number | null; // escala MTT 10.0–100.0 con 1 decimal
  passed: boolean | null; // true si grade >= 75
  status: 'draft' | 'confirmed';
  recorded_by: number | null;
  created_at: string;
  updated_at: string;
}
