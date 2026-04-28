/**
 * Modelos UI para la vista de Control de Asistencia — Clase B.
 * Consolida clases teóricas (grupales/Zoom) y prácticas (individuales).
 */

import type { EvaluationChecklistItem } from './instructor-portal.model';
export type { EvaluationChecklistItem };

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
  /** Clases prácticas con status en_curso en este momento. */
  clasesEnCurso: number;
  /** Clases pendientes cuya hora ya pasó y aún no se han iniciado. */
  pendientesPorIniciar: number;
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
  studentId: number | null;
  classNumber: number | null;
  /** Hora agendada originalmente (scheduled_at). */
  horaInicio: string; // "09:00"
  /** Hora real en que se inició la clase (start_time). null si aún no inició. */
  horaInicioReal: string | null;
  /** Hora real en que se finalizó la clase (end_time). null si aún no finalizó. */
  horaFinReal: string | null;
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
  kmStart: number | null;
  vehiclePlate: string | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleId: number | null;
  /** Kilometraje actual del vehículo (vehicles.current_km) al momento de cargar la sesión. */
  vehicleCurrentKm: number | null;
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

/** Opción de vehículo para el selector en el drawer de iniciar clase. */
export interface VehicleOption {
  id: number;
  plate: string;
  brand: string | null;
  model: string | null;
  currentKm: number | null;
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

/** Payload para finalizar una clase práctica desde admin/secretaria. */
export interface FinishClassPayload {
  sessionId: number;
  studentId: number | null;
  kmEnd: number;
  grade: number;
  observations: string;
  checklist: EvaluationChecklistItem[];
  studentSignature: string | null;
  instructorSignature: string | null;
}

/** Alumno con su estado de asistencia para el drawer de una clase teórica. */
export interface TeoriaAlumnoAsistencia {
  /** PK de la tabla students — clave primaria usada para upsert de asistencia. */
  studentId: number;
  alumnoName: string;
  email: string;
  status: TeoriaAsistenciaStatus;
  justificacion: string | null;
}
