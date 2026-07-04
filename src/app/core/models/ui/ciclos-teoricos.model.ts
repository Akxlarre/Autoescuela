/**
 * Modelos UI para el Motor de Ciclos Teóricos (Clase B) — Spec 0001.
 * Un ciclo = cohorte de 2 semanas con 6 clases (L/X/V). Sin asistencia.
 */

export type CicloStatus = 'active' | 'finished';

/** Opción del selector de ciclos (RF-11). */
export interface CicloOption {
  id: number;
  /** Etiqueta legible, ej: "Ciclo — Lunes 15 de Octubre". */
  label: string;
  startDate: string; // YYYY-MM-DD (lunes)
  endDate: string; // YYYY-MM-DD (viernes semana 2)
  status: CicloStatus;
  branchId: number;
  branchName: string;
}

/** Fila de una de las 6 clases del ciclo (RF-12/14). */
export interface CicloClaseRow {
  id: number;
  /** 1–6. */
  claseNumero: number;
  /** YYYY-MM-DD de la clase. */
  fecha: string;
  /** Etiqueta legible, ej: "Clase 1 — Lun 9 mar". */
  label: string;
  /** Tema opcional editable; se incluye en el correo si está. */
  tema: string | null;
  zoomLink: string | null;
  /** ISO timestamp del último envío del enlace, o null si nunca. */
  zoomSentAt: string | null;
}

/** Alumno perteneciente a la cohorte de un ciclo (RF-12). */
export interface CicloAlumno {
  studentId: number;
  enrollmentId: number;
  nombre: string;
  email: string;
}

/** Alumno asignado a OTRO ciclo, candidato a ser traído al ciclo actual (override). */
export interface CicloAlumnoMovible extends CicloAlumno {
  /** Ciclo en el que está actualmente. */
  cicloActualId: number;
  cicloActualLabel: string;
}

/** Resultado del envío masivo de enlaces Zoom. */
export interface ZoomEmailResult {
  sent: number;
  errors: string[];
}
