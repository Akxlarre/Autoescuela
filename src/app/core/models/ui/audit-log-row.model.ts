export type AuditAction = 'Crear' | 'Actualizar' | 'Eliminar';

export interface AuditLogRow {
  id: number;
  fechaHora: string; // ISO string
  usuarioNombre: string;
  usuarioEmail: string;
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
  class_b_theory_sessions: 'Agenda',
  // M3 - Finanzas
  payments: 'Pagos',
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
  'Otros',
];
