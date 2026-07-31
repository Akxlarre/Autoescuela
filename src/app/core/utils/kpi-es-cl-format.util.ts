/**
 * Formateo es-CL de valores numéricos de KPI.
 *
 * ## Por qué existe
 *
 * `app-kpi-card-variant` no formatea en el template (`{{ value() }}` crudo): quien
 * formatea es `GsapAnimationsService.animateCounter()`, que sobrescribe el
 * `textContent` con el valor localizado a es-CL.
 *
 * El strip de KPIs del hero en `density="slim"` **no** pasa por `animateCounter` —
 * renderiza `{{ kpi.value }}` tal cual. Migrar un KPI de una celda `bento-square`
 * al array `[kpis]` del hero pierde entonces el formato silenciosamente
 * (`0,8 hrs` → `0.8 hrs`, `1.240` → `1240`). Ningún assert geométrico lo detecta.
 *
 * Esta función replica **exactamente** la regla de `animateCounter` para que la
 * migración a slim sea fiel. Ver `fix-072-b-portales-hero-slim`.
 */
export function formatKpiEsCl(value: number): string {
  if (!Number.isFinite(value)) return '—';

  const hasDecimals = value % 1 !== 0;

  return hasDecimals
    ? value.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : Math.round(value).toLocaleString('es-CL');
}
