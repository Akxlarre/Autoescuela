// Módulos de Auditoría para las edge functions (fix-487-m).
//
// ⚠️ Copia espejo de `src/app/core/models/ui/audit-log-row.model.ts` (Deno no puede importar
// `src/app/`). Cambiar las dos: `audit-modules.parity.spec.ts` falla si divergen. Antes cada
// copia evolucionaba por su lado y la exportación no conocía "Instructores": filtrar por él no
// filtraba nada.

/** Módulo legible por tabla. Solo tablas con trigger `log_change()`. */
export const ENTITY_MODULE_MAP: Record<string, string> = {
  users: 'Usuarios',
  enrollments: 'Matrículas',
  class_b_sessions: 'Agenda',
  class_b_theory_sessions: 'Ciclos Teóricos',
  payments: 'Pagos',
  enrollment_payment_overrides: 'Pagos',
  students: 'Alumnos',
  student_documents: 'Alumnos',
  promotion_courses: 'Clase Profesional',
  professional_theory_sessions: 'Clase Profesional',
  professional_practice_sessions: 'Clase Profesional',
  professional_module_grades: 'Clase Profesional',
  class_book: 'Libro de Clases',
  vehicles: 'Flota',
  vehicle_documents: 'Flota',
  maintenance_records: 'Flota',
  certificates: 'Certificación',
  instructors: 'Instructores',
  vehicle_assignments: 'Instructores',
  branch_payroll_config: 'Liquidaciones',
  website_config: 'Sitio Web',
  special_service_sales: 'Servicios Especiales',
  standalone_course_enrollments: 'Cursos Singulares',
  professional_pre_registrations: 'Clase Profesional',
  courses: 'Precios y Descuentos',
  discounts: 'Precios y Descuentos',
  discount_applications: 'Precios y Descuentos',
  cash_closings: 'Caja y Gastos',
  cuadratura_adjustments: 'Caja y Gastos',
  expenses: 'Caja y Gastos',
  fixed_expenses: 'Caja y Gastos',
};

/** Opciones del filtro de módulo, en el orden de la pantalla. */
export const MODULE_OPTIONS = [
  'Usuarios',
  'Matrículas',
  'Pagos',
  'Agenda',
  'Ciclos Teóricos',
  'Alumnos',
  'Clase Profesional',
  'Flota',
  'Certificación',
  'Libro de Clases',
  'Instructores',
  'Liquidaciones',
  'Precios y Descuentos',
  'Caja y Gastos',
  'Servicios Especiales',
  'Cursos Singulares',
  'Sitio Web',
  'Otros',
];

/** Tablas con módulo propio; "Otros" es todo lo demás. */
export const KNOWN_ENTITIES = Object.keys(ENTITY_MODULE_MAP);
