/** UI model para un alumno con saldo pendiente en la vista de Gestión de Pagos. */
export interface AlumnoDeudor {
  enrollmentId: number;
  /** Nombre completo: first_names + paternal_last_name */
  alumno: string;
  rut: string;
  /** base_price - discount */
  totalAPagar: number;
  pagado: number;
  saldo: number;
  /** `courses.type`: 'class_b' | 'professional' | 'singular' — para el filtro de tipo de curso. */
  cursoTipo: string | null;
  cursoNombre: string;
  /** `enrollments.created_at` (fecha de matrícula) — único campo de fecha disponible en esta tabla. */
  fechaMatricula: string | null;
  /** `enrollments.number` (fix-053-i): distingue dos matrículas con saldo del mismo alumno. */
  numeroMatricula: string | null;
  /** `enrollments.status` (fix-053-i): 'active' | 'pending_payment' | 'completed' | 'cancelled'. */
  estadoMatricula: string | null;
  sedeId: number;
  sedeNombre: string;
}

/** Datos de un pago anulado (spec 0025-m): se muestra tachado y no suma en ningún total. */
export interface AnulacionPago {
  motivo: string;
  /** Nombre del admin que anuló; null si quien mira no puede leerlo. */
  por: string | null;
  /** Fecha y hora de Chile, lista para mostrar ("13/10/2026 23:30"). */
  cuando: string;
}

/** UI model para una fila de la tabla Pagos Recientes. */
export interface PagoReciente {
  id: number;
  fecha: string | null;
  alumno: string;
  concepto: string | null;
  monto: number;
  /** Derivado: 'Transferencia' | 'Efectivo' | 'Débito/Crédito' | 'WebPay' | 'Mixto' | '—' */
  metodo: string;
  /** Lucide icon name para el método de pago. */
  metodoIcono: string;
  nroDocumento: string | null;
  estado: string | null;
  /** Presente solo si el pago fue anulado (spec 0025-m). */
  anulacion: AnulacionPago | null;
}

/** UI model para la distribución de métodos de pago del mes actual. */
export interface MetodoPago {
  metodo: string;
  total: number;
  porcentaje: number;
  /** CSS custom property, ej: 'var(--color-primary)' */
  color: string;
  /** Lucide icon name. */
  icono: string;
}

/** UI model para el resumen del estado de cuenta de una matrícula específica. */
export interface EstadoCuentaResumen {
  enrollmentId: number;
  alumno: string;
  rut: string;
  email: string | null;
  telefono: string | null;
  curso: string;
  basePrice: number;
  descuento: number;
  /** basePrice - descuento */
  totalACurso: number;
  totalPagado: number;
  saldoPendiente: number;
  paymentStatus: string | null;
}

/** UI model para una fila del historial de pagos de una matrícula específica. */
export interface EstadoCuentaHistorialItem {
  id: number;
  fecha: string | null;
  concepto: string | null;
  metodo: string;
  metodoIcono: string;
  nroDocumento: string | null;
  monto: number;
  estado: string | null;
  /** Presente solo si el pago fue anulado (spec 0025-m). */
  anulacion: AnulacionPago | null;
}
