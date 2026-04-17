/**
 * Modelos UI para la vista de Control de Asistencia — Clase B.
 * Consolida clases teóricas (grupales/Zoom) y prácticas (individuales).
 */

export type ClasePracticaStatus = 'presente' | 'ausente' | 'en_curso' | 'pendiente';
export type ZoomLinkStatus = 'sent' | 'pending' | 'not_configured';
export type NivelAlerta = 'warning' | 'danger';

/** KPIs superiores de la vista de asistencia. */
export interface AsistenciaClaseBKpis {
  /** Porcentaje de asistencia del día (0–100). */
  tasaAsistencia: number;
  /** Delta vs mes anterior (puede ser negativo). */
  tasaAsistenciaTrend: number;
  /** Cantidad de inasistencias confirmadas hoy. */
  inasistenciasHoy: number;
  /** Total de clases programadas para hoy. */
  totalClasesHoy: number;
  /** Alumnos con ≥1 falta consecutiva en prácticas. */
  alumnosEnRiesgo: number;
  /** Horarios desactivados manualmente en la semana en curso. */
  horariosEliminados: number;
}

/** Fila de clase teórica grupal (Zoom). */
export interface ClaseTeoricoRow {
  id: number;
  horaInicio: string; // "18:00"
  horaFin: string; // "19:30"
  tema: string;
  instructorName: string;
  inscritosCount: number;
  zoomLinkStatus: ZoomLinkStatus;
  zoomLink: string | null;
  branchId: number;
  branchName: string;
}

/** Fila de clase práctica individual para la tabla de asistencia del día. */
export interface ClasePracticaRow {
  /** ID de class_b_sessions */
  id: number;
  enrollmentId: number | null;
  horaInicio: string; // "09:00"
  instructorId: number;
  instructorName: string;
  /** null cuando el slot no tiene alumno agendado */
  alumnoName: string | null;
  status: ClasePracticaStatus;
  justificacion: string | null;
  branchId: number;
  branchName: string;
  /** ISO datetime string of the scheduled start (to compare with current time). */
  scheduledAt: string;
}

/** Alerta por faltas consecutivas en prácticas. */
export interface AlertaFaltaConsecutiva {
  studentId: number;
  enrollmentId: number;
  alumnoName: string;
  faltasConsecutivas: number;
  nivel: NivelAlerta;
  /** ISO date string de la última falta registrada */
  ultimaFechaFalta: string;
  /** true = el horario sigue activo; false = ya fue eliminado manualmente */
  horarioActivo: boolean;
  branchId: number;
  branchName: string;
}

/** Opción para el filtro de instructores en la tabla de prácticas. */
export interface InstructorOption {
  id: number;
  name: string;
}

/** Estado de asistencia de un alumno en una clase teórica grupal. */
export type TeoriaAsistenciaStatus = 'presente' | 'ausente' | 'justificado' | 'pendiente';

/** Alumno elegible para inscribirse en una clase teórica. */
export interface TeoriaAlumnoElegible {
  studentId: number;
  enrollmentId: number;
  alumnoName: string;
  email: string;
  selected: boolean;
}

/** Payload para crear una nueva sesión teórica. */
export interface NuevaClaseTeoricaPayload {
  branchId: number;
  scheduledDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  topic: string;
  zoomLink?: string;
  enrollmentIds: number[];
}

/** Alumno con su estado de asistencia para el drawer de una clase teórica. */
export interface TeoriaAlumnoAsistencia {
  studentId: number;
  enrollmentId: number;
  alumnoName: string;
  email: string;
  status: TeoriaAsistenciaStatus;
  justificacion: string | null;
}
