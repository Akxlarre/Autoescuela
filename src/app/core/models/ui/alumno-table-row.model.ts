// UI Model for the "Base de Alumnos" table view.
// Derived from: students + users + enrollments + courses + student_documents

export interface EnrollmentCurso {
  nombre: string;
  licenseGroup: 'class_b' | 'professional';
}

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

/** Columnas por las que se puede ordenar la Base de Alumnos (spec 0020-m). */
export type AlumnoSortField =
  | 'alumno'
  | 'rut'
  | 'nroExpediente'
  | 'curso'
  | 'sede'
  | 'fechaIngreso'
  | 'estado'
  | 'expediente';

export type AlumnoSortDirection = 'asc' | 'desc';

export interface AlumnoListSort {
  field: AlumnoSortField;
  direction: AlumnoSortDirection;
}

/**
 * Búsqueda, filtros y orden de la Base de Alumnos. Cadena vacía = sin filtrar;
 * `sort: null` = orden por defecto (alumno más reciente primero).
 */
export interface AlumnoListFilters {
  search: string;
  curso: string;
  estado: string;
  expediente: string;
  sort: AlumnoListSort | null;
  /** fix-282-m: índice de la primera fila de la página de la tabla (0 = página 1). */
  first: number;
  /** fix-282-m: tarjetas cargadas en la vista angosta ("Cargar más"). */
  cardsShown: number;
}

export const EMPTY_ALUMNO_LIST_FILTERS: AlumnoListFilters = {
  search: '',
  curso: '',
  estado: '',
  expediente: '',
  sort: null,
  first: 0,
  cardsShown: 6,
};

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
  /** enrollments[].number — all non-draft enrollment numbers */
  nroExpedientes: string[];
  /** enrollments.created_at (formatted date) — from most recent enrollment */
  fechaIngreso: string;
  /**
   * enrollments.created_at sin formatear, para ordenar por fecha real (spec 0020-m):
   * `fechaIngreso` es texto dd-mm-aaaa y no se puede comparar.
   */
  fechaIngresoIso?: string | null;
  /** Derived from enrollment.status + payment_status + docs_complete — most recent */
  status: AlumnoStatus;
  /** All courses across enrollments */
  cursos: EnrollmentCurso[];
  /** Suma de enrollments.pending_balance de todas las matrículas Clase B válidas (fix-270-m) */
  pago_por_pagar: number;
  /** Suma de enrollments.total_paid de todas las matrículas Clase B válidas (fix-270-m) */
  pago_total: number;
  /** Derived from class_b_exam_scores (default 'pendiente') */
  exp_teorico: 'pendiente' | 'aprobado' | 'reprobado';
  /** Derived from class_b_sessions progress (default 'pendiente') */
  exp_practico: 'pendiente' | 'aprobado' | 'reprobado';
  /** Derived from student_documents types */
  expediente: AlumnoExpediente;
  /** enrollments.id for navigation */
  enrollmentId?: number;
  /**
   * true si la matrícula (Clase B) tiene las 12 prácticas completas y el certificado
   * ya fue enviado por email, pero `enrollments.status` sigue `active` — todavía no
   * se marcó como ex-alumno (fix-012-i).
   */
  cursoCompletoPendienteEgreso: boolean;
}
