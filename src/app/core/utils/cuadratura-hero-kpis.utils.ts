import type { SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { formatCLP } from './date.utils';

/**
 * Entrada para la franja de KPIs del hero de Cuadratura Diaria.
 *
 * La franja representa la **cuadratura en efectivo** (el arqueo físico): los 4
 * KPIs suman entre sí — `fondoInicial + ingresosEfectivo − egresosEfectivo =
 * saldoTeorico`. Los totales por todos los métodos de pago viven en el pie de
 * cada panel ("Total Día" / "Total Egresos"), no acá (fix-230-m).
 */
export interface CuadraturaHeroKpiInput {
  /** Fondo de apertura de la caja del día. */
  fondoInicial: number;
  /** Ingresos del día pagados en efectivo. */
  ingresosEfectivo: number;
  /** Egresos del día pagados en efectivo. */
  egresosEfectivo: number;
  /** Saldo teórico esperado en caja — lo calcula el Facade, acá NO se recalcula. */
  saldoTeorico: number;
}

/**
 * Arma los 4 KPIs de la cabecera de Cuadratura Diaria: la resta de la caja en
 * efectivo de un vistazo (apertura + ingresos − egresos = saldo esperado).
 * Mismo patrón que `servicios-especiales-content` → `<app-section-hero [kpis]>`.
 */
export function buildCuadraturaHeroKpis(input: CuadraturaHeroKpiInput): SectionHeroKpi[] {
  return [
    {
      id: 'fondo-inicial',
      label: 'Fondo inicial',
      value: formatCLP(input.fondoInicial),
      icon: 'wallet',
    },
    {
      id: 'ingresos-efectivo',
      label: 'Ingresos del día (efectivo)',
      value: formatCLP(input.ingresosEfectivo),
      color: 'success',
    },
    {
      id: 'egresos-efectivo',
      label: 'Egresos del día (efectivo)',
      value: formatCLP(input.egresosEfectivo),
      color: 'warning',
    },
    {
      id: 'saldo-esperado',
      label: 'Saldo esperado en caja',
      value: formatCLP(input.saldoTeorico),
      trendLabel: 'Apertura + ingresos − egresos en efectivo',
    },
  ];
}
