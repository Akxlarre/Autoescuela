/**
 * Modelos UI para la Ficha del Alumno (/admin/alumnos/:id).
 * Derivados de: students + users + enrollments + class_b_*_attendance
 */

export interface AlumnoDetalleUI {
  id: number;
  /** PK de la matrícula activa — requerido para insertar en absence_evidence */
  enrollmentId: number | null;
  nombre: string;
  rut: string;
  matricula: string;
  curso: string;
  email: string;
  telefono: string;
  fechaIngreso: string;
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
  /** Fecha formateada "DD-MM" (ej: "12-01") o null si la clase aún no ocurrió */
  fecha: string | null;
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
