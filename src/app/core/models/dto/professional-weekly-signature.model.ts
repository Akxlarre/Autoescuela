// DTO: professional_weekly_signatures
// Firma semanal presencial de alumnos de Clase Profesional.
// Una fila por alumno × semana, registrada por secretaría al cierre de la semana.

export interface ProfessionalWeeklySignature {
  id: number;
  promotion_course_id: number;
  enrollment_id: number;
  /** Siempre el lunes de la semana correspondiente. Formato: 'YYYY-MM-DD'. */
  week_start_date: string;
  signed_at: string;
  recorded_by: number;
  notes: string | null;
}
