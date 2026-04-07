/**
 * Modelos UI para la vista de Evaluaciones de Clase Profesional.
 * Escala MTT: 10–100 con 1 decimal. Mínimo aprobación: 75.
 */

/** Una celda de nota para un alumno en un módulo específico */
export interface CeldaNota {
  /** null = aún no registrada */
  grade: number | null;
  /** true si grade >= 75, null si grade es null */
  passed: boolean | null;
  /** Estado persisitido en BD */
  status: 'draft' | 'confirmed';
  /** ID del registro en BD (null = aún no existe) */
  gradeId: number | null;
  /** true si el usuario la ha editado en la sesión actual sin guardar */
  dirty: boolean;
}

/** Fila de la tabla: un alumno con sus 7 notas y su promedio */
export interface FilaEvaluacion {
  enrollmentId: number;
  nombre: string;
  rut: string;
  initials: string;
  /** Array de 7 celdas, índice 0 = módulo 1 … índice 6 = módulo 7 */
  notas: CeldaNota[];
  /** Promedio de las notas registradas, null si ninguna */
  promedio: number | null;
  /** true si el promedio es >= 75 */
  promedioAprobado: boolean | null;
}

/** Estado global de la grilla para un curso de promoción */
export interface GrillaEvaluacion {
  promotionCourseId: number;
  promotionName: string;
  courseName: string;
  licenseClass: string;
  /** Nombres de los 7 módulos según licenseClass */
  moduleNames: string[];
  /** Total de alumnos matriculados */
  totalAlumnos: number;
  filas: FilaEvaluacion[];
  /** true si al menos una nota está en estado 'confirmed' (grilla bloqueada) */
  confirmed: boolean;
}
