/**
 * Modelos UI para la Ficha del Alumno (/admin/alumnos/:id).
 * Derivados de: students + users + enrollments + class_b_*_attendance / professional_*
 */

export interface EnrollmentSummary {
  id: number;
  number: string | null;
  courseName: string;
  licenseGroup: 'class_b' | 'professional';
  promotionCourseId: number | null;
  createdAt: string;
  certPdfUrl: string | null;
  /** Carnet Clase B de 6 clases (fondo amarillo). null si aún no se generó. */
  licenseInitialUrl: string | null;
  /** Carnet Clase B de 12 clases (fondo verde). null si aún no se generó. */
  licenseFullUrl: string | null;
  contractFileUrl: string | null;
  contractSignedUrl: string | null;
  registrationChannel: 'presential' | 'online' | null;
  totalPagado: number;
  saldoPendiente: number;
}

export interface AlumnoDetalleUI {
  id: number;
  /** PK de la fila en tabla `users` — requerido para .update() al editar perfil */
  userId: number;
  /** PK de la matrícula activa — requerido para insertar en absence_evidence */
  enrollmentId: number | null;
  /** Todas las matrículas del alumno, ordenadas de más reciente a más antigua */
  enrollments: EnrollmentSummary[];
  /** Nombre completo para mostrar */
  nombre: string;
  /** Campos individuales para pre-rellenar el formulario de edición */
  firstName: string;
  paternalLastName: string;
  maternalLastName: string;
  rut: string;
  matricula: string;
  curso: string;
  email: string;
  telefono: string;
  fechaIngreso: string;
  estado: string;
  /** 'class_b' | 'professional' — determina qué secciones de progreso mostrar */
  licenseGroup: 'class_b' | 'professional';
  /** Suma de pagos confirmados (enrollments.total_paid) */
  totalPagado: number;
  /** Saldo aún no abonado (enrollments.pending_balance) */
  saldoPendiente: number;
}

/** Progreso de asistencia para alumnos profesionales (teoría o práctica). */
export interface ProgresoAsistenciaProf {
  /** Porcentaje de asistencia (0-100) o null si no hay sesiones registradas aún. */
  pct: number | null;
  asistidas: number;
  totales: number;
}

/** Criterios de elegibilidad para certificado profesional (UI). */
export interface ElegibilidadProfUI {
  /** Asistencia teórica >= 75 % */
  teoria: boolean;
  /** Asistencia práctica >= 100 % (criterio flexible) */
  practica: boolean;
  /** Saldo pendiente <= 0 */
  pago: boolean;
  /** Nota promedio de módulos >= 75 */
  nota: boolean;
}

export interface PagoUI {
  id: number;
  /** Fecha formateada "DD/MM/YYYY" (ej: "15/01/2026") */
  fecha: string;
  /** Descripción del pago (notes o fallback genérico) */
  concepto: string;
  monto: number;
  /** "Efectivo" | "Transferencia" | "Tarjeta" | null */
  metodo: string | null;
  /** Estado legible: "Pagado" | "Pendiente" | etc. (derivado del status de BD) */
  estado: string;
}

export interface InasistenciaUI {
  id: number;
  /** Fecha formateada para mostrar (ej: "20 ene. 2026") */
  fecha: string;
  /** document_type de absence_evidence */
  documentType: string;
  /** Descripción / motivo detallado */
  description: string | null;
  /** URL del archivo adjunto (puede ser null si es simulado) */
  fileUrl: string | null;
  /** Estado de revisión: 'pending' | 'approved' | 'rejected' */
  status: string;
}

/**
 * Inasistencia de clase práctica Clase B (RF-053), derivada de
 * `class_b_practice_attendance` — incluye tanto las marcadas automáticamente
 * (fin de jornada / secretaria) como las justificadas.
 */
export interface InasistenciaClaseBUI {
  /** PK de la fila en class_b_practice_attendance */
  id: number;
  /** PK de la fila en class_b_sessions asociada */
  sessionId: number | null;
  claseNumero: number | null;
  /** Fecha formateada para mostrar (ej: "20 ene. 2026") */
  fecha: string;
  /** true si status='excused' */
  justificada: boolean;
  /** Motivo de justificación, si ya fue justificada */
  justificacion: string | null;
  instructor: string | null;
  /** true si la sesión asociada ya no está en 'no_show' (fue reciclada por el flujo de reagendar) */
  reagendada: boolean;
}

/**
 * Clase práctica pendiente de reagendar (RF-053): sesión en `cancelled`
 * (penalización) o `no_show` (inasistencia a recuperar). Alimenta el checklist
 * del drawer "Reagendar Clases".
 */
export interface ClasePendienteReagendarUI {
  /** PK de la fila en class_b_sessions */
  sessionId: number;
  claseNumero: number;
  /** Origen: determina el trato en el backend (reciclar in-place vs insertar nueva) */
  origen: 'no_show' | 'cancelled';
  /** Fecha originalmente agendada, formateada "DD-MM" — solo contexto informativo */
  fechaOriginal: string | null;
  /** true si origen='no_show' y su class_b_practice_attendance.status='excused' (ya justificada) */
  justificada: boolean;
}

export interface ClasePracticaUI {
  numero: number;
  /** PK de la fila en class_b_sessions — null si la clase aún no tiene sesión agendada */
  sessionId: number | null;
  /** Fecha formateada "DD-MM" (ej: "12-01") o null si la clase aún no ocurrió */
  fecha: string | null;
  /** Fecha ISO "YYYY-MM-DD" para comparaciones lógicas — null si la clase no tiene sesión */
  scheduledDate: string | null;
  /** Timestamp ISO completo (scheduled_at de la BD) para validaciones de orden cronológico */
  scheduledAt: string | null;
  /** Hora "HH:MM-HH:MM" (ej: "15:50-16:35") o null si pendiente */
  hora: string | null;
  /** Nombre completo del instructor o null si pendiente */
  instructor: string | null;
  kmInicio: number | null;
  kmFin: number | null;
  /** performance_notes ?? notes de la sesión */
  observaciones: string | null;
  /** true si ambas firmas están presentes */
  completada: boolean;
  /** true si class_b_sessions.status = 'no_show' (inasistencia, con o sin justificar) */
  ausente: boolean;
  /** true si class_b_sessions.status = 'cancelled' (RF-053: liberada por penalización, pendiente de reagendar) */
  cancelada: boolean;
  /** true si la inasistencia de esta clase ya fue justificada (class_b_practice_attendance.status='excused') */
  justificada: boolean;
  /** Motivo guardado por la secretaria al justificar, si existe */
  justificacion: string | null;
  alumnoFirmo: boolean;
  instructorFirmo: boolean;
}

export interface ProgresoUI {
  completadas: number;
  /** Total requerido según el plan del curso (Clase B: 12 prácticas / 8 teóricas) */
  requeridas: number;
}
