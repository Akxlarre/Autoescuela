/**
 * Modelos de UI para el módulo de Cursos Singulares (RF-035).
 * El Facade transforma los DTOs crudos de BD en estos modelos listos para la vista.
 */

/** Tipo de curso singular. */
export type TipoCursoSingular = 'sence' | 'particular';

/** Estado del curso. */
export type EstadoCursoSingular = 'upcoming' | 'active' | 'completed' | 'cancelled';

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
  paymentStatus: 'paid' | 'pending' | 'partial';
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
