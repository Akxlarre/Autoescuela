// UI Model for the "Base de Alumnos" table view.
// Derived from: students + users + enrollments + courses + student_documents

export type AlumnoStatus =
  | 'Activo'
  | 'Finalizado'
  | 'Retirado'
  | 'Pre-inscrito'
  | 'Pendiente Pago'
  | 'Docs Pendientes'
  | 'Inactivo';

export interface AlumnoExpediente {
  /** Cédula de identidad (student_documents.type = 'cedula_identidad') */
  ci: boolean;
  /** Foto carnet (student_documents.type = 'foto_carnet') */
  foto: boolean;
  /** Certificado médico (student_documents.type = 'certificado_medico') */
  medico: boolean;
  /** SEMEP (student_documents.type = 'semep') */
  semep: boolean;
}

export interface AlumnoTableRow {
  /** students.id */
  id: string;
  /** users.first_names */
  nombre: string;
  /** users.paternal_last_name + maternal_last_name */
  apellido: string;
  /** users.rut */
  rut: string;
  /** users.email */
  email: string;
  /** users.phone */
  celular: string;
  /** branch name (users.branch_id) */
  sucursal: string;
  /** students.district */
  comuna: string;
  /** enrollments.number */
  nroExpediente: string;
  /** enrollments.created_at (formatted date) */
  fechaIngreso: string;
  /** Derived from enrollment.status + payment_status + docs_complete */
  status: AlumnoStatus;
  /** courses.name */
  cursa: string;
  /** enrollments.pending_balance */
  pago_por_pagar: number;
  /** enrollments.total_paid */
  pago_total: number;
  /** Derived from class_b_exam_scores (default 'pendiente') */
  exp_teorico: 'pendiente' | 'aprobado' | 'reprobado';
  /** Derived from class_b_sessions progress (default 'pendiente') */
  exp_practico: 'pendiente' | 'aprobado' | 'reprobado';
  /** Derived from student_documents types */
  expediente: AlumnoExpediente;
  /** Raw ISO string from enrollments.expires_at */
  expiresAt: string | null;
  /** Formatted label for "Por Vencer" drawer (e.g. 'Hoy', 'En 3 días') */
  vencimiento?: string;
  /** enrollments.id for navigation */
  enrollmentId?: number;
}
