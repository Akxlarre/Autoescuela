/**
 * Modelos de UI para la vista Archivo · Clase Profesional.
 * Consolida asistencia + notas de módulos de una promoción finalizada.
 */

export interface ArchivoPromocionOption {
  id: number;
  code: string;
  name: string;
  startDate: string;
  endDate: string | null;
  label: string;
}

export interface ArchivoCursoOption {
  id: number; // promotion_course_id
  courseName: string;
  licenseClass: string;
  label: string;
}

export interface ArchivoNotaModulo {
  moduleNumber: number; // 1-indexed (1-7)
  grade: number | null;
  passed: boolean | null;
}

export interface ArchivoAlumnoRow {
  enrollmentId: number;
  studentId: number;
  nombre: string;
  initials: string;
  rut: string;
  // Asistencia teórica
  teoriaAsistida: number;
  teoriaTotal: number;
  pctTeoria: number | null;
  // Asistencia práctica
  practicaAsistida: number;
  practicaTotal: number;
  pctPractica: number | null;
  // Evaluaciones (7 módulos)
  notas: ArchivoNotaModulo[];
  notaPromedio: number | null;
  promedioAprobado: boolean | null;
  // Estado final: teoría ≥ 75% AND promedio ≥ 75
  aprobado: boolean;
}

export interface ArchivoKpis {
  totalAlumnos: number;
  aprobados: number;
  reprobados: number;
  pctAprobacion: number;
}
