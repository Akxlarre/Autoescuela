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

/** Estado de avance de un curso en el aterrizaje (tarjeta de curso). */
export type CursoEstado = 'sin_iniciar' | 'en_edicion' | 'confirmada';

/** Resumen vivo de un curso para la tarjeta del aterrizaje. */
export interface CursoResumen {
  /** PK de `promotion_courses` — se pasa a `selectCurso()`. */
  promotionCourseId: number;
  /** Clase de licencia (A2, A3…) — etiqueta corta de la tarjeta. */
  courseCode: string;
  courseName: string;
  totalAlumnos: number;
  /** Alumnos con al menos una nota registrada. */
  alumnosConNotas: number;
  /** Alumnos con las 7 notas registradas. */
  alumnosCompletos: number;
  /** Promedio del curso (media de promedios individuales), null si ninguno. */
  promedio: number | null;
  estado: CursoEstado;
}

/** Una promoción (objeto padre) con sus cursos resumidos, para el aterrizaje. */
export interface PromocionConCursos {
  id: number;
  name: string;
  code: string;
  status: string;
  cursos: CursoResumen[];
  /** Totales agregados de la promoción (cabecera del grupo). */
  totalAlumnos: number;
  cursosConfirmados: number;
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
