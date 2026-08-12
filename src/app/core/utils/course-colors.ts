/**
 * Constantes compartidas para el color de curso/código Clase Profesional (A2–A5).
 * Usadas en: AdminProfesionalPromocionesComponent y sus drawers.
 */

export const COURSE_COLORS: Record<string, string> = {
  A2: '#3b82f6',
  A3: '#8b5cf6',
  A4: '#f59e0b',
  A5: '#10b981',
};

export function getCourseColor(code: string): string {
  return COURSE_COLORS[code] ?? '#6b7280';
}
