/** Fila del historial de cierres de caja para la vista de Historial de Cuadraturas. */
export interface HistorialCierre {
  id: number;
  branchId: number | null;
  /** Fecha del cierre (DATE string, ej: '2026-03-31') */
  fecha: string;
  /** Siempre `true` en este modelo — el historial solo trae cierres cerrados (spec 0002-i). */
  closed: boolean;
  /**
   * Fondo de apertura real del día (`cash_closings.opening_amount`, spec 0012-m).
   * `null` en cierres previos a 0012-m — la UI muestra "No registrado" en vez de un
   * default falso (fix-226-m borró el `50_000` hardcodeado que enmascaraba el dato).
   */
  fondoInicial: number | null;
  /** Saldo teórico del sistema (balance = fondoInicial + ingresos - egresos) */
  saldoSistema: number;
  /** Saldo físico contado en arqueo */
  saldoFisico: number;
  /** diferencia = saldoFisico - saldoSistema */
  diferencia: number;
  /** Nombre del cajero que cerró la caja */
  cajero: string;
  totalIngresos: number;
  /** Ingresos cobrados en efectivo (`cash_closings.cash_amount`) — lo que entra físicamente a la caja. */
  ingresosEfectivo: number;
  /** Total de egresos del día — TODOS los métodos de pago. */
  totalEgresos: number;
  /**
   * Subconjunto de `totalEgresos` pagado en efectivo — lo único que baja el saldo físico
   * de la caja (fix-211-m). Viene de `cash_closings.cash_expenses`; para cierres previos a
   * fix-226-m (columna `null`) se deriva como `fondoInicial + cash_amount − saldoSistema`.
   */
  cashExpenses: number;
  /** Derivado: `totalEgresos − cashExpenses` — egreso pagado con tarjeta/transferencia, no afecta el arqueo. */
  nonCashExpenses: number;
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
