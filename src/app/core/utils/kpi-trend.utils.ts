/**
 * Helpers puros de la tendencia de `app-kpi-card-variant`.
 * Extraídos del componente para poder testearlos sin TestBed.
 */

/**
 * Color de la tendencia. Por defecto subir es bueno (success). Con `invert` (métricas donde
 * subir es malo, como gastos — spec 0044-b AC11) se invierte. Una variación 0 nunca se pinta
 * como error.
 */
export function kpiTrendColor(trend: number, invert = false): string {
  if (trend === 0) return 'var(--state-success)';
  const good = invert ? trend < 0 : trend > 0;
  return good ? 'var(--state-success)' : 'var(--state-error)';
}

export interface TrendView {
  color: string;
  icon: 'trending-up' | 'trending-down';
  text: string;
}

/** Color, ícono y texto de una tendencia en un solo objeto (para el template). */
export function trendView(trend: number, suffix: string, invert = false): TrendView {
  return {
    color: kpiTrendColor(trend, invert),
    icon: trend >= 0 ? 'trending-up' : 'trending-down',
    text: formatTrendDisplay(trend, suffix),
  };
}

/**
 * `14.7` → `+14.7%`; `-3` → `3%`. Los negativos van SIN signo a propósito: el ícono
 * `trending-down` ya indica la dirección (comportamiento histórico del componente).
 */
export function formatTrendDisplay(trend: number, suffix: string): string {
  const sign = trend >= 0 ? '+' : '';
  const abs = Math.abs(trend);
  return `${sign}${abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(1)}${suffix}`;
}
