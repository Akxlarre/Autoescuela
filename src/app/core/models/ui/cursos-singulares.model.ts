/**
 * Modelos de UI para el módulo de Cursos Singulares (RF-035).
 * El Facade transforma los DTOs crudos de BD en estos modelos listos para la vista.
 */

/** Tipo de curso singular. */
export type TipoCursoSingular = 'sence' | 'particular';

/** Estado del curso. */
export type EstadoCursoSingular = 'upcoming' | 'active' | 'completed' | 'cancelled';

export type SingularPaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'pendiente';
export type SingularPaymentStatus = 'paid' | 'pending' | 'partial';

/** Fila para la tabla de cursos singulares. */
export interface CursoSingularRow {
  id: number;
  nombre: string;
  tipo: TipoCursoSingular;
  billingType: 'sence_franchise' | 'boleta' | 'factura';
  precio: number;
  duracionHoras: number;
  inscritos: number;
  cupos: number;
  estado: EstadoCursoSingular;
  inicio: string; // ISO date string
  ingresoEstimado: number; // precio × inscritos
}

/** KPIs del módulo Cursos Singulares. */
export interface CursosSingularesKpis {
  cursosActivos: number;
  totalCursos: number;
  totalInscritos: number;
  ingresosEstimados: number; // solo cursos activos + completados
}

/** Inscripto individual en un curso singular (para el drawer de detalle/cobro). */
export interface InscriptoCursoSingular {
  enrollmentId: number;
  studentId: number;
  nombreAlumno: string;
  rutAlumno: string;
  montoPagado: number;
  paymentStatus: SingularPaymentStatus;
  paymentMethod: SingularPaymentMethod;
  enrolledAt: string;
}

/** Payload para el formulario "Nuevo Curso". */
export interface NuevoCursoSingularFormData {
  nombre: string;
  tipo: TipoCursoSingular;
  billingType: 'sence_franchise' | 'boleta' | 'factura';
  precio: number;
  duracionHoras: number;
  cupos: number;
  inicio: string; // ISO date string
}

/** Resultado de búsqueda de alumno por RUT para el wizard de inscripción. */
export interface SingularStudentSearch {
  userId: number;
  studentId: number | null;
  /** Nombre completo para mostrar en UI. */
  nombreCompleto: string;
  /** Nombres separados para pre-cargar el formulario correctamente. */
  firstNames: string;
  paternalLastName: string;
  rut: string;
  email: string;
  phone: string;
}

/** Formulario de datos personales del wizard de inscripción a curso singular. */
export interface SingularPersonalDataForm {
  rut: string;
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  email: string;
  phone: string;
  birthDate: string;
  gender: 'M' | 'F';
  address: string;
}

/** Formulario de pago del wizard de inscripción a curso singular. */
export interface SingularPaymentForm {
  amountPaid: number;
  paymentMethod: SingularPaymentMethod;
  paymentStatus: SingularPaymentStatus;
}
