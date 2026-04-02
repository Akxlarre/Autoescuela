/** Fila de ingreso (payment) para la tabla de cuadratura diaria. */
export interface IngresoRow {
  id: number;
  /** FK a enrollments — necesario para revertir saldos al eliminar. */
  enrollmentId: number | null;
  nBoleta: string | null;
  glosa: string;
  /** cash_amount del pago */
  claseB: number;
  /** transfer_amount del pago */
  claseA: number;
  /** voucher_amount del pago */
  sence: number;
  /** card_amount del pago */
  otros: number;
  total: number;
}

/** Fila de egreso (expense o instructor_advance) para la cuadratura. */
export interface EgresoRow {
  id: number;
  tipo: 'expense' | 'advance';
  descripcion: string;
  monto: number;
}

/** Datos del formulario para registrar un egreso desde el modal. */
export interface EgresoFormData {
  tipo: 'gasto' | 'anticipo';
  monto: number;
  descripcion: string;
}

/** Payload que emite el componente al cerrar la caja. */
export interface CierrePayload {
  bill20000: number;
  bill10000: number;
  bill5000: number;
  bill2000: number;
  bill1000: number;
  coin500: number;
  coin100: number;
  coin50: number;
  coin10: number;
  notes: string;
  arqueoTotal: number;
}
