export type AuditAction = 'Crear' | 'Actualizar' | 'Eliminar';

/** Filtro "Quién" de Auditoría (fix-069-i). `sistema` = filas sin usuario (limpieza automática). */
export type AuditActor = 'todos' | 'secretarias' | 'admin' | 'sistema';

export const AUDIT_ACTOR_OPTIONS: { label: string; value: AuditActor }[] = [
  { label: 'Todos', value: 'todos' },
  { label: 'Secretarias', value: 'secretarias' },
  { label: 'Administradores', value: 'admin' },
  { label: 'Sistema (automático)', value: 'sistema' },
];

/** Opción del filtro de usuario: secretarias y administradores (fix-069-i). */
export interface AuditUsuarioOption {
  id: number;
  nombre: string;
  email: string;
  rol: string;
}

export interface AuditLogRow {
  id: number;
  fechaHora: string; // ISO string
  usuarioNombre: string;
  /** Rol legible de quien hizo la acción, o "Sistema" (fix-069-i). */
  usuarioRol: string;
  usuarioEmail: string;
  sedeNombre: string;
  accion: AuditAction;
  modulo: string;
  detalle: string;
  ip: string;
}

/** Módulos legibles por entidad de BD.
 *  Solo incluir entidades que tienen trigger log_change() activo.
 *  Entidades sin trigger nunca generan registros en audit_log. */
export const ENTITY_MODULE_MAP: Record<string, string> = {
  // M1 - Usuarios
  users: 'Usuarios',
  // M4 - Académico B
  enrollments: 'Matrículas',
  class_b_sessions: 'Agenda',
  class_b_theory_sessions: 'Ciclos Teóricos',
  // M3 - Finanzas
  payments: 'Pagos',
  // spec 0010-i: habilitación sin pago (clase 7+ / certificado) — trigger en 20261013120000
  enrollment_payment_overrides: 'Pagos',
  // M1 - Alumnos (triggers agregados en 20260323110000)
  students: 'Alumnos',
  student_documents: 'Alumnos',
  // M5 - Clase Profesional
  promotion_courses: 'Clase Profesional',
  professional_theory_sessions: 'Clase Profesional',
  professional_practice_sessions: 'Clase Profesional',
  professional_module_grades: 'Clase Profesional',
  // M9 - Calidad
  class_book: 'Libro de Clases',
  // M7 - Flota (triggers agregados en 20260323110000)
  vehicles: 'Flota',
  vehicle_documents: 'Flota',
  maintenance_records: 'Flota',
  // M10 - Certificación (triggers agregados en 20260323110000)
  certificates: 'Certificación',
  // fix-206-b: triggers agregados en 20261007150000
  instructors: 'Instructores',
  vehicle_assignments: 'Instructores',
  branch_payroll_config: 'Liquidaciones',
};

export const ACTION_LABEL_MAP: Record<string, AuditAction> = {
  INSERT: 'Crear',
  UPDATE: 'Actualizar',
  DELETE: 'Eliminar',
};

/** Todas las entidades conocidas con trigger activo (usado para filtro "Otros") */
export const KNOWN_ENTITIES = Object.keys(ENTITY_MODULE_MAP);

/** Opciones para filtro de módulo en la vista */
export const MODULE_OPTIONS = [
  'Usuarios',
  'Matrículas',
  'Pagos',
  'Agenda',
  'Alumnos',
  'Clase Profesional',
  'Flota',
  'Certificación',
  'Libro de Clases',
  'Instructores',
  'Liquidaciones',
  'Otros',
];
