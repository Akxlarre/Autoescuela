/** Fila de liquidación mensual por instructor. */
export interface LiquidacionRow {
  instructorId: number;
  userId: number;
  nombre: string;
  rut: string;
  initials: string;
  avatarColor: string;
  totalHours: number;
  amountPerHour: number;
  totalBaseAmount: number;
  totalAdvances: number;
  finalPaymentAmount: number;
  status: 'pending' | 'paid';
  /** Seteado si status === 'paid' */
  paymentId?: number;
  paymentMethod?: string;
  paymentDate?: string;
  transferCode?: string | null;
}

/** KPIs agregados de la nómina mensual. */
export interface LiquidacionesKpis {
  totalNomina: number;
  totalAnticipos: number;
  totalPagados: number;
  totalInstructores: number;
}

/** Payload emitido por el modal al guardar el pago. */
export interface PagoInstructorPayload {
  paymentMethod: 'cash' | 'transfer';
  transferCode: string | null;
}
