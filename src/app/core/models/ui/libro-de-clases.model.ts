import type { AsistenciaStatus } from './sesion-profesional.model';

// ── Selector de libro (spec 0018-m) ─────────────────────────────────────────

/** Licencia que se convalida: Conv. A-3 (alumnos A5) o Conv. A-4 (alumnos A2). */
export type ConvalidationLicense = 'A3' | 'A4';

/**
 * Una de las 6 opciones del selector del Libro de Clases: los 4 cursos de la promoción más
 * los 2 libros de convalidación. Un libro de convalidación no tiene `promotion_course` propio
 * (spec 0018-m, opción B): `promotionCourseId` apunta a su curso madre.
 */
export interface LibroOption {
  /** Identificador estable del libro: `"<promotionCourseId>"` o `"<promotionCourseId>:A3|A4"`. */
  key: string;
  promotionCourseId: number;
  convalidation: ConvalidationLicense | null;
  label: string;
}

// ── Cabecera del Libro ───────────────────────────────────────────────────────

export interface LibroCabecera {
  /** `null` = libro normal del curso; 'A3'/'A4' = libro de convalidación (spec 0018-m). */
  convalidation: ConvalidationLicense | null;
  /** Asignaturas de la página de Evaluaciones: 7 en un libro normal, 5 en convalidación. */
  moduleNames: string[];
  promotionName: string;
  promotionCode: string;
  courseName: string;
  bookId: string;
  licenseClass: string;
  startDate: string;
  endDate: string;
  branchName: string;
  branchAddress: string;
  status: string;
  /** Campos editables del libro (almacenados en class_book) */
  classBookId: number | null;
  senceCode: string;
  /** Auditoría del último cambio al Código SENCE (RF-103, fiscalizable) */
  senceCodeUpdatedByName: string | null;
  senceCodeUpdatedAt: string | null;
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
  /** null: el Libro de Clases es una plantilla imprimible, no se precarga desde BD (fix-250-m). */
  pctPractica: number | null;
  pctTeorica: number | null;
}

// ── Calendario de clases ─────────────────────────────────────────────────────

export interface ClaseCalendario {
  numero: number;
  fecha: string;
  asignatura: string;
  horas: number;
  profesor: string;
}
