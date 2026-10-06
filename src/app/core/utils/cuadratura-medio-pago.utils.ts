import type { IngresoRow } from '@core/models/ui/cuadratura.model';

/**
 * Etiqueta de la columna "Medio" de la tabla compacta de Ingresos de la Caja Diaria (fix-192-b).
 * Cuando la tabla es angosta, las 4 columnas de monto por medio de pago se reemplazan por esta:
 * el nombre del medio si se usó uno solo, "Mixto" si fueron varios, "—" si no hay montos.
 *
 * Los campos conservan nombres heredados: claseB = efectivo, claseA = transferencia,
 * sence = voucher, otros = tarjeta (ver `IngresoRow`).
 */
export function medioDePagoLabel(
  fila: Pick<IngresoRow, 'claseB' | 'claseA' | 'sence' | 'otros'>,
): string {
  const usados = [
    fila.claseB > 0 ? 'Efectivo' : null,
    fila.claseA > 0 ? 'Transf.' : null,
    fila.sence > 0 ? 'Voucher' : null,
    fila.otros > 0 ? 'Tarjeta' : null,
  ].filter((m): m is string => m !== null);

  if (usados.length === 0) return '—';
  return usados.length === 1 ? usados[0] : 'Mixto';
}
