import type { LayoutTier } from '@core/models/ui/layout.model';

/**
 * Functional Core del layout responsive dual (spec 0028).
 *
 * Umbrales espejo de los breakpoints del bento grid en
 * `src/styles/layout/_bento-grid.scss` ($bp-sm: 640px, $bp-lg: 1024px).
 * Si cambian allá, deben cambiar acá.
 */
const TIER_TABLET_MIN = 640;
const TIER_DESKTOP_MIN = 1024;

/**
 * Mapea el ancho del contenedor `layoutmain` (<main>) a un tier de layout.
 * `null` (SSR o observer aún no montado) se trata como desktop para no
 * recortar datos antes de tener una medición real.
 */
export function widthToTier(width: number | null): LayoutTier {
  if (width === null) return 'desktop';
  if (width < TIER_TABLET_MIN) return 'mobile';
  if (width < TIER_DESKTOP_MIN) return 'tablet';
  return 'desktop';
}

/**
 * Recorta una lista al presupuesto de densidad del tier.
 * `budget === null` significa "sin límite" (modo desktop).
 */
export function sliceByBudget<T>(items: readonly T[], budget: number | null): T[] {
  if (budget === null || items.length <= budget) return [...items];
  return items.slice(0, budget);
}

/** A qué tab pertenecen los clicks acumulados de "Cargar más" (spec 0029). */
export interface LoadMoreState {
  readonly forTab: string | null;
  readonly clicks: number;
}

/**
 * Recorta una lista aplicando "Cargar más" de forma tab-scoped: los clicks
 * solo cuentan si pertenecen al tab activo — evita que un contador de otro
 * tab (o un refresh SWR que no toca el tab) infle el presupuesto por error.
 * `budget === null` significa "sin límite" (desktop): ignora el estado de
 * "Cargar más" por completo.
 */
export function visibleWithLoadMore<T>(
  items: readonly T[],
  budget: number | null,
  activeTab: string,
  loadMore: LoadMoreState,
): T[] {
  if (budget === null) return sliceByBudget(items, null);
  const clicks = loadMore.forTab === activeTab ? loadMore.clicks : 0;
  return sliceByBudget(items, budget * (1 + clicks));
}
