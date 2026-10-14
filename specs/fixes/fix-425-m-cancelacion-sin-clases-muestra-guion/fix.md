# Fix: "Cancelación e inasistencia" muestra "0 %" cuando no hubo clases en el período
> id: fix-425-m-cancelacion-sin-clases-muestra-guion
> refs: fix-395-m-testing-dashboards (caso D08, decisión de Matías 2026-10-14)
> status: done
> closed: 2026-10-14
> created: 2026-10-14

## Síntoma

En el dashboard ejecutivo, con un período sin clases, el KPI "Cancelación e inasistencia" muestra
"0 %" (con "Sin clases en el período" debajo). Un 0 % se lee como un resultado perfecto, no como
"no hay datos".

## Root Cause

`buildKpiCards()` convierte la tasa `null` (sin clases) en `0` porque `ExecKpiCard.value` es un
número, y `toHeroKpi()` la imprime con el sufijo `%`.

## Fix

Decisión de Matías: "—" en vez de "0 %". `ExecKpiCard` suma `noData` (sin dato que mostrar); la
tarjeta de cancelación lo marca cuando la tasa es `null` y `toHeroKpi()` imprime "—" sin sufijo.

## Acceptance Criteria

- [x] AC1 — Sin clases en el período, el KPI muestra "—" sin "%" y sigue diciendo "Sin clases en
  el período".
- [x] AC2 — Con clases, sigue mostrando el porcentaje.

## Regression Test

- `executive-dashboard.utils.spec.ts` → `fix-425-m`

## Verificación (2026-10-14)

- Unit: `executive-dashboard.utils.spec.ts`, 2 tests nuevos (sin clases → "—" sin "%"; con clases →
  "12,5 %"). Con los specs del dashboard: 93/93. `tsc` sin errores.
- Navegador, admin: la respuesta real de `exec_dashboard_kpis` interceptada con 0 clases realizadas,
  canceladas e inasistencias (la BD de dev tiene clases en todos los presets): el hero muestra
  "Cancelación e inasistencia — / Sin clases en el período", sin "%".
