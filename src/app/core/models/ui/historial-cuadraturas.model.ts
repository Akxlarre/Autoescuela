/** Fila del historial de cierres de caja para la vista de Historial de Cuadraturas. */
export interface HistorialCierre {
  id: number;
  /** Fecha del cierre (DATE string, ej: '2026-03-31') */
  fecha: string;
  fondoInicial: number;
  /** Saldo teórico del sistema (balance = fondoInicial + ingresos - egresos) */
  saldoSistema: number;
  /** Saldo físico contado en arqueo */
  saldoFisico: number;
  /** diferencia = saldoFisico - saldoSistema */
  diferencia: number;
  /** Nombre del cajero que cerró la caja */
  cajero: string;
  totalIngresos: number;
  totalEgresos: number;
  /** Derivado: 'balanced' | 'surplus' | 'shortage' */
  estadoDiferencia: 'balanced' | 'surplus' | 'shortage';

  // ── Desglose de denominaciones del arqueo ──────────────────────────────────
  qtyBill20000: number;
  qtyBill10000: number;
  qtyBill5000: number;
  qtyBill2000: number;
  qtyBill1000: number;
  qtyCoin500: number;
  qtyCoin100: number;
  qtyCoin50: number;
  qtyCoin10: number;

  notes: string | null;
}

/** Filtro de rango de fechas para el historial (legacy, no usado en el calendario). */
export interface HistorialFiltro {
  fechaInicio: string | null;
  fechaFin: string | null;
}
