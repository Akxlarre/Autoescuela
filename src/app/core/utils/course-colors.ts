/**
 * Constantes compartidas para el color de curso/código Clase Profesional (A2–A5).
 * Usadas en: AdminProfesionalPromocionesComponent y sus drawers.
 *
 * fix-236-b: tonos 600/700 — las insignias llevan texto blanco y deben cumplir 4,5:1 (WCAG AA).
 */

export const COURSE_COLORS: Record<string, string> = {
  A2: '#2563eb',
  A3: '#7c3aed',
  A4: '#b45309',
  A5: '#047857',
};

export function getCourseColor(code: string): string {
  return COURSE_COLORS[code] ?? '#4b5563';
}
