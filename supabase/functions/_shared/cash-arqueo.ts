// supabase/functions/_shared/cash-arqueo.ts
//
// Lectura del resultado del arqueo de un cierre de caja (`cash_closings`), compartida por
// generate-cash-history-report y generate-cash-closing-report. Espejo de
// `mapCierreToHistorial()` (src/app/core/facades/historial-cuadraturas.facade.ts).
//
// fix-074-i: un cierre sin arqueo guarda arqueo_amount/difference null. Leer ese null como 0
// convertía el día en un "Faltante" de toda la caja; ahora es "Sin arqueo".

export type EstadoArqueo = 'Cuadrado' | 'Sobrante' | 'Faltante' | 'Sin arqueo';

export interface ArqueoRow {
  balance?: number | null;
  arqueo_amount?: number | null;
  difference?: number | null;
}

export interface ArqueoResult {
  saldoSistema: number;
  /** Efectivo contado. `null` si se cerró sin arqueo. */
  saldoFisico: number | null;
  /** saldoFisico − saldoSistema. `null` si se cerró sin arqueo. */
  diferencia: number | null;
  estado: EstadoArqueo;
}

export function resolveArqueo(row: ArqueoRow): ArqueoResult {
  const saldoSistema = row.balance ?? 0;
  if (row.arqueo_amount == null) {
    return { saldoSistema, saldoFisico: null, diferencia: null, estado: 'Sin arqueo' };
  }
  const saldoFisico = row.arqueo_amount;
  const diferencia = row.difference ?? saldoFisico - saldoSistema;
  const estado: EstadoArqueo =
    diferencia === 0 ? 'Cuadrado' : diferencia > 0 ? 'Sobrante' : 'Faltante';
  return { saldoSistema, saldoFisico, diferencia, estado };
}
