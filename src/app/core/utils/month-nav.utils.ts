import { chileParts } from '@core/utils/chile-time.utils';

/**
 * ¿Se puede navegar al mes siguiente de (anio, mes)? Solo si (anio, mes) es anterior al mes
 * actual de Chile: los meses futuros no tienen cierres ni liquidaciones (fix-079-i, F04).
 * `mes` va de 1 a 12.
 */
export function puedeAvanzarMes(anio: number, mes: number, now: Date = new Date()): boolean {
  const hoy = chileParts(now);
  return anio * 12 + mes < hoy.year * 12 + hoy.month;
}
