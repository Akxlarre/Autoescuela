/**
 * Catálogo de módulos de Clase Profesional (Art. 16 Reglamento MTT).
 *
 * Escala: 10–100 con 1 decimal. Mínimo de aprobación: 75.
 *
 * El módulo 5 varía según el tipo de licencia del curso:
 *  - A2 / A3 (incluye conv_a3) → Transporte de Pasajeros
 *  - A4 / A5 (incluye conv_a4) → Transporte de Carga / Sust. Peligrosa
 */

export const GRADE_MIN = 10;
export const GRADE_MAX = 100;
export const GRADE_PASS = 75;
export const MODULE_COUNT = 7;

/** Módulos comunes a todos los cursos (1–4 y 6–7) */
const BASE_MODULES: Record<number, string> = {
  1: 'Ley del Tránsito, Responsabilidad Civil y Penal',
  2: 'Prevención de Riesgos',
  3: 'Infraestructura y Educación Vial',
  4: 'Mecánica',
  6: 'Conducción',
  7: 'Aspectos Psicológicos y de Comunicación',
};

const MODULE_5_PASAJEROS = 'Transporte de Pasajeros';
const MODULE_5_CARGA = 'Transporte de Carga / Sust. Peligrosa';

/**
 * Devuelve el array de 7 nombres de módulo según la clase de licencia del curso.
 * El índice 0 corresponde al módulo 1, el índice 6 al módulo 7.
 *
 * @param licenseClass — valor de `courses.license_class` ('A2', 'A3', 'A4', 'A5')
 */
export function getModuleNames(licenseClass: string): string[] {
  const module5 =
    licenseClass === 'A4' || licenseClass === 'A5' ? MODULE_5_CARGA : MODULE_5_PASAJEROS;

  return [
    BASE_MODULES[1],
    BASE_MODULES[2],
    BASE_MODULES[3],
    BASE_MODULES[4],
    module5,
    BASE_MODULES[6],
    BASE_MODULES[7],
  ];
}

/**
 * Devuelve el nombre abreviado de un módulo para encabezados de tabla.
 * Ej: "Módulo 1", "Módulo 5"
 */
export function getModuleShortLabel(moduleNumber: number): string {
  return `Módulo ${moduleNumber}`;
}

/**
 * Determina si una nota está aprobada según la escala MTT.
 */
export function isPassing(grade: number): boolean {
  return grade >= GRADE_PASS;
}

/**
 * Redondea la nota según Art. 16: un decimal, elevando la centésima ≥ 5
 * a la décima inmediatamente superior (comportamiento nativo de toFixed).
 */
export function roundGrade(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Calcula el promedio de notas dadas (ignora nulos/undefined).
 * Retorna null si no hay ninguna nota registrada.
 */
export function calcAverage(grades: (number | null)[]): number | null {
  const valid = grades.filter((g): g is number => g !== null && !isNaN(g));
  if (valid.length === 0) return null;
  return roundGrade(valid.reduce((sum, g) => sum + g, 0) / valid.length);
}
