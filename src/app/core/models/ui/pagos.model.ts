/** UI model para una fila de la tabla Rentabilidad Estimada por Tipo de Curso (RF-040). */
export interface RentabilidadCurso {
  tipoCurso: string;
  ingresos: number;
  gastosDirectos: number;
  margenNeto: number;
  rentabilidadPorcentaje: number;
  /** CSS custom property, ej: 'var(--color-primary)' */
  colorVisual: string;
}

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
}
