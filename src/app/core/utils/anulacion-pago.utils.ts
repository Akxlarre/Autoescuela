import type { AnulacionPago } from '@core/models/ui/pagos.model';

/**
 * Texto de una línea con el detalle de un pago anulado: "motivo · quién · cuándo" (spec 0025-m).
 * Si quien mira no puede leer el nombre de quien anuló, se muestra "Administrador": solo un
 * admin puede anular.
 */
export function formatAnulacionDetalle(anulacion: AnulacionPago | null | undefined): string {
  if (!anulacion) return '';
  return [anulacion.motivo, anulacion.por ?? 'Administrador', anulacion.cuando].join(' · ');
}

/**
 * Conteo para el pie de una lista que muestra los pagos anulados junto a los vigentes: los
 * anulados se listan, pero no cuentan como ítems de la lista.
 * Ej.: "Mostrando 3 ingresos · 1 anulado".
 */
export function resumenConAnulados(
  filas: readonly { anulacion?: AnulacionPago | null }[],
  singular: string,
  plural: string,
): string {
  const anulados = filas.filter((fila) => fila.anulacion).length;
  const vigentes = filas.length - anulados;
  const base = `Mostrando ${vigentes} ${vigentes === 1 ? singular : plural}`;
  if (anulados === 0) return base;
  return `${base} · ${anulados} ${anulados === 1 ? 'anulado' : 'anulados'}`;
}
