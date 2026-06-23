// UI Model para la "Base de Alumnos Profesional" (spec 0016).
// Derivado de: enrollments(license_group='professional') + students + users
//   + promotion_courses→courses + v_professional_attendance + professional_module_grades

import type { AlumnoStatus } from './alumno-table-row.model';

/** Semáforo de asistencia profesional (v_professional_attendance.attendance_flag). */
export type SemaforoAsistencia = 'green' | 'yellow' | 'red';

export interface AlumnoProfesionalTableRow {
  /** students.id */
  id: string;
  /** users.first_names */
  nombre: string;
  /** users.paternal_last_name + maternal_last_name */
  apellido: string;
  /** users.rut */
  rut: string;
  /** users.email */
  email: string;
  /** users.phone */
  celular: string;
  /** enrollments.number ('—' si aún no tiene número asignado) */
  nroMatricula: string;
  /** courses.name de la promoción (ej. "Profesional A4"); '—' si sin promoción (AC-E3) */
  promocion: string;
  /** courses.license_class del curso profesional (A2/A3/A4/A5); '' si sin promoción */
  licenseClass: string;
  /** v_professional_attendance.attendance_flag; null si aún no hay sesiones registradas */
  semaforo: SemaforoAsistencia | null;
  /** Módulos aprobados (professional_module_grades.passed = true) */
  modulosAprobados: number;
  /** Total de módulos del programa (MODULE_COUNT = 7) */
  modulosTotal: number;
  /** Derivado de enrollments.status */
  estado: AlumnoStatus;
  /** enrollments.pending_balance */
  saldo: number;
  /** enrollments.id para navegación/acciones */
  enrollmentId: number;
}
