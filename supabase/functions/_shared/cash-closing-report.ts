// supabase/functions/_shared/cash-closing-report.ts
//
// Reglas del exporte de la Caja Diaria (generate-cash-closing-report). Copia espejo de
// CuadraturaFacade (src/app/core/facades/cuadratura.facade.ts): el Excel/PDF tiene que decir lo
// mismo que la pantalla (fix-076-i). Si cambia el cálculo allá, cambiarlo acá y en el test.

export interface IngresoMontos {
  efectivo: number;
  transferencia: number;
  tarjeta: number;
  sence: number;
  total: number;
}

/**
 * Columna de un ingreso según su medio de pago (curso singular, servicio especial), igual que
 * `mapSingularSaleToIngreso` / `mapSpecialServiceSaleToIngreso`. Sin medio = efectivo.
 */
export function ingresoByMethod(monto: number, metodo: string | null | undefined): IngresoMontos {
  const m = metodo ?? 'efectivo';
  return {
    efectivo: m === 'efectivo' ? monto : 0,
    transferencia: m === 'transferencia' ? monto : 0,
    tarjeta: m === 'tarjeta' ? monto : 0,
    sence: m === 'sence' ? monto : 0,
    total: monto,
  };
}

const METHOD_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  sence: 'SENCE',
};

export function paymentMethodLabel(metodo: string | null | undefined): string {
  const m = metodo ?? 'efectivo';
  return METHOD_LABEL[m] ?? m;
}

/** Montos guardados en `cash_closings` al cerrar la caja. */
export interface CierreSnapshot {
  opening_amount: number | null;
  total_income: number | null;
  cash_amount: number | null;
  total_expenses: number | null;
  /** Egreso pagado en efectivo (fix-226-m). Null en cierres anteriores a esa columna. */
  cash_expenses: number | null;
  balance: number | null;
}

export interface CajaTotals {
  fondoInicial: number;
  totalIngresos: number;
  totalEfectivo: number;
  totalEgresos: number;
  /** Lo único que baja el saldo físico (fix-211-m). */
  totalEgresosEfectivo: number;
  saldoTeorico: number;
}

/**
 * Totales del reporte. Caja abierta: el cálculo de la pantalla
 * (saldo teórico = fondo + ingresos en efectivo − egresos en efectivo). Caja cerrada: los montos
 * del cierre guardado, para que un movimiento posterior no cambie el archivo.
 */
export function resolveCajaTotals(input: {
  ingresos: { efectivo: number; total: number }[];
  egresos: { monto: number; metodoPago: string | null }[];
  fondoInicial: number;
  snapshot: CierreSnapshot | null;
}): CajaTotals {
  const s = input.snapshot;
  if (s) {
    const fondoInicial = s.opening_amount ?? 0;
    const totalEfectivo = s.cash_amount ?? 0;
    const saldoTeorico = s.balance ?? 0;
    return {
      fondoInicial,
      totalIngresos: s.total_income ?? 0,
      totalEfectivo,
      totalEgresos: s.total_expenses ?? 0,
      totalEgresosEfectivo: s.cash_expenses ?? fondoInicial + totalEfectivo - saldoTeorico,
      saldoTeorico,
    };
  }
  const totalIngresos = input.ingresos.reduce((a, i) => a + i.total, 0);
  const totalEfectivo = input.ingresos.reduce((a, i) => a + i.efectivo, 0);
  const totalEgresos = input.egresos.reduce((a, e) => a + e.monto, 0);
  const totalEgresosEfectivo = input.egresos.reduce(
    (a, e) => a + ((e.metodoPago ?? 'efectivo') === 'efectivo' ? e.monto : 0),
    0,
  );
  return {
    fondoInicial: input.fondoInicial,
    totalIngresos,
    totalEfectivo,
    totalEgresos,
    totalEgresosEfectivo,
    saldoTeorico: input.fondoInicial + totalEfectivo - totalEgresosEfectivo,
  };
}

/** Con la caja cerrada, el detalle muestra solo lo que existía al cerrar. */
export function rowsAtClose<T extends { registradoEn: string | null }>(
  rows: T[],
  closedAt: string | null,
): T[] {
  if (!closedAt) return rows;
  const corte = new Date(closedAt).getTime();
  return rows.filter((r) => !r.registradoEn || new Date(r.registradoEn).getTime() <= corte);
}

function clpAbs(n: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(Math.abs(n));
}

/** Diferencia del arqueo con un solo signo: "Faltante: $500", nunca "$-500". */
export function diferenciaLabel(dif: number | null): string {
  if (dif === null) return 'Sin arqueo';
  if (dif === 0) return 'Cuadrado';
  return dif > 0 ? `Sobrante: ${clpAbs(dif)}` : `Faltante: ${clpAbs(dif)}`;
}
