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
  fecha: string;
  tipo: 'Práctica' | 'Teórica';
  motivo: string | null;
  estado: 'Justificada' | 'Injustificada';
}

export interface ProgresoUI {
  completadas: number;
  /** Total requerido según el plan del curso (Clase B: 12 prácticas / 8 teóricas) */
  requeridas: number;
}
