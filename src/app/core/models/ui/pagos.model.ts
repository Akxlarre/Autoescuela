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
