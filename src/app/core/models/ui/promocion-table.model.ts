/**
 * UI Models para Gestión de Promociones Profesionales.
 * Transformados desde DTOs en PromocionesFacade.
 */

/** Curso dentro de una promoción (vista de tabla/detalle). */
export interface PromocionCursoRow {
  id: number;
  courseCode: string; // 'A2' | 'A3' | 'A4' | 'A5'
  courseName: string; // 'Taxis y colectivos', etc.
  courseId: number;
  enrolledStudents: number;
  maxStudents: number;
  relatores: PromocionCursoRelator[];
}

/** Relator asignado a un curso de promoción. */
export interface PromocionCursoRelator {
  id: number; // promotion_course_lecturers.id
  lecturerId: number;
  nombre: string;
  initials: string;
  role: 'theory' | 'practice' | 'both' | null;
  specializations: string[];
}

/** Fila de la tabla principal de promociones. */
export interface PromocionTableRow {
  id: number;
  code: string;
  name: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  status: PromocionStatus;
  statusLabel: string;
  currentDay: number;
  maxStudents: number;
  totalEnrolled: number;
  cursos: PromocionCursoRow[];
}

export type PromocionStatus = 'planned' | 'in_progress' | 'finished' | 'cancelled';

/** Opciones de relator disponibles para asignar a cursos. */
export interface RelatorOption {
  id: number;
  nombre: string;
  initials: string;
  specializations: string[];
}

/** Payload para crear curso dentro de una promoción. */
export interface CrearPromocionCursoPayload {
  courseId: number;
  lecturerIds: number[];
}

/** Payload para crear promoción. */
export interface CrearPromocionPayload {
  name: string;
  code: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  cursos: CrearPromocionCursoPayload[];
}

/** Alumno inscrito en un curso de promoción. */
export interface PromocionAlumno {
  enrollmentId: number;
  studentId: number;
  nombre: string;
  rut: string;
  initials: string;
  enrollmentStatus: string;
}

/** Payload para editar promoción. */
export interface EditarPromocionPayload {
  name: string;
  code: string;
  status: PromocionStatus;
}
