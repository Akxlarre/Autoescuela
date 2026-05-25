/**
 * Modelos UI para la Ficha del Alumno (/admin/alumnos/:id).
 * Derivados de: students + users + enrollments + class_b_*_attendance / professional_*
 */

export interface AlumnoDetalleUI {
  id: number;
  /** PK de la fila en tabla `users` — requerido para .update() al editar perfil */
  userId: number;
  /** PK de la matrícula activa — requerido para insertar en absence_evidence */
  enrollmentId: number | null;
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

export interface ClasePracticaUI {
  numero: number;
  /** PK de la fila en class_b_sessions — null si la clase aún no tiene sesión agendada */
  sessionId: number | null;
  /** Fecha formateada "DD-MM" (ej: "12-01") o null si la clase aún no ocurrió */
  fecha: string | null;
  /** Fecha ISO "YYYY-MM-DD" para comparaciones lógicas — null si la clase no tiene sesión */
  scheduledDate: string | null;
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
  alumnoFirmo: boolean;
  instructorFirmo: boolean;
}

export interface ProgresoUI {
  completadas: number;
  /** Total requerido según el plan del curso (Clase B: 12 prácticas / 8 teóricas) */
  requeridas: number;
}
