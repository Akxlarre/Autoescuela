import type { AsistenciaStatus } from './sesion-profesional.model';

// ── Cabecera del Libro ───────────────────────────────────────────────────────

export interface LibroCabecera {
  promotionName: string;
  promotionCode: string;
  courseName: string;
  courseCode: string;
  licenseClass: string;
  startDate: string;
  endDate: string;
  branchName: string;
  branchAddress: string;
  status: string;
  /** Campos editables del libro (almacenados en class_book) */
  classBookId: number | null;
  senceCode: string;
  horario: string;
}

// ── Profesores por módulo ────────────────────────────────────────────────────

export interface ProfesorModulo {
  moduleNumber: number;
  moduleName: string;
  lecturerName: string;
}

// ── Lista de alumnos ─────────────────────────────────────────────────────────

export interface AlumnoLibro {
  numero: number;
  enrollmentId: number;
  nombre: string;
  rut: string;
  telefono: string;
  licenciaPostulada: string;
}

// ── Asistencia semanal ───────────────────────────────────────────────────────

export interface AlumnoAsistenciaSemanal {
  enrollmentId: number;
  nombre: string;
  asistenciaDias: (AsistenciaStatus | null)[];
  firmaSemanal: boolean;
}

export interface SemanaAsistencia {
  weekNumber: number;
  weekLabel: string;
  weekStartDate: string;
  dias: { date: string; dayLabel: string }[];
  alumnos: AlumnoAsistenciaSemanal[];
}

// ── Evaluaciones ─────────────────────────────────────────────────────────────

export interface FilaEvaluacionLibro {
  nombre: string;
  rut: string;
  notas: (number | null)[];
  notaFinal: number | null;
  aprobado: boolean;
}

// ── Resumen de asistencia ────────────────────────────────────────────────────

export interface ResumenAsistenciaLibro {
  nombre: string;
  pctPractica: number;
  pctTeorica: number;
}

// ── Calendario de clases ─────────────────────────────────────────────────────

export interface ClaseCalendario {
  numero: number;
  fecha: string;
  asignatura: string;
  horas: number;
  profesor: string;
}
