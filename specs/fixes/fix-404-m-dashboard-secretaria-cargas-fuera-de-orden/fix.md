# Fix: cargas fuera de orden en el dashboard de secretaria al cambiar de sede seguido
> id: fix-404-m-dashboard-secretaria-cargas-fuera-de-orden
> refs: fix-395-m-testing-dashboards (casos R02, J02; sospecha S13a) · fix-403-m · fix-174-b (mismo defecto en el ejecutivo) · facades.md §7
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

Secretaria multi-sede, cambiando de sede antes de que termine la carga anterior (cada carga tarda
3–6 s; visto el 2026-10-13 tras `fix-403-m`): el skeleton se apaga con datos que no son de la sede
elegida (bajo "Conductores Chillán" se vieron los 67 alumnos de "Autoescuela Chillán"), y las
alertas pueden quedar con las de la sede anterior.

## Root Cause

Los dos Facades del dashboard de secretaria no protegen todo lo que una carga escribe:

- `DashboardFacade.initialize()`: el `finally` de **cualquier** llamada apaga `loading` y fija
  `_lastBranchId`, aunque ya haya otra carga más nueva en curso (el defecto que `fix-174-b`
  corrigió en `ExecutiveDashboardFacade`).
- `DashboardFacade.fetchRealDashboardData()`: revisa el guard y **después** espera
  `fetchLiveClasses()` dentro del `data.set(...)`; una carga vieja que pasó el guard puede escribir
  al final y pisar a la vigente.
- `DashboardAlertsFacade` no usa `createRequestGuard()`: gana la respuesta que llega última, no la
  de la última sede pedida. Tiene el mismo `finally` sin protección.

## Fix

- `DashboardFacade`: las clases actuales se piden junto con el resto de las consultas (antes del
  guard), y solo la carga más reciente apaga `loading` y registra la sede cargada.
- `DashboardAlertsFacade`: guard de orden en `fetchAlertsData()` y el mismo criterio para
  `isLoading` y la sede cargada.

## Acceptance Criteria

- [x] AC1 — Con dos cargas del dashboard en curso, si la vieja termina primero el skeleton sigue
      hasta que termina la vigente.
- [x] AC2 — Una carga vieja del dashboard que termina última no cambia los datos.
- [x] AC3 — Con dos cargas de alertas en curso, quedan las alertas de la última pedida aunque la
      primera responda después, y `isLoading` sigue hasta que termina la vigente.
- [x] AC4 — Un error de la carga vigente se sigue mostrando (el guard no lo tapa).

## Regression Test

- `dashboard.facade.spec.ts` → `Request guard` (casos fix-404-m)
- `dashboard-alerts.facade.spec.ts` → `cargas fuera de orden (fix-404-m)`

## Verificación (2026-10-13)

- Unit: `dashboard.facade.spec.ts` 29/29 y `dashboard-alerts.facade.spec.ts` 56/56 (5 tests nuevos,
  rojo → verde). `tsc` sin errores. La constante `QUERIES_POR_CARGA` del test de carrera pasó de 10
  a 12: las dos consultas de "Clases Actuales" ahora van en la misma tanda.
- Navegador, secretaria multi-sede, sede 1 → 2 → 1 → 2 sin esperar: el skeleton se mantiene hasta
  el final y termina con los datos de la sede 2 (130 alumnos, 8 vehículos, 40 pagos pendientes).
  Sede 1 y, 1,2 s después, "Todas": termina con 197, 17 y 62. En ningún momento se vio un número de
  otra sede sin skeleton.
