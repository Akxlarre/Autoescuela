# Fix: las alertas del dashboard de secretaria no cambian con un pago u otro cambio en vivo
> id: fix-420-m-alertas-del-dashboard-no-siguen-el-tiempo-real
> refs: fix-395-m-testing-dashboards (casos L04, O06) · fix-407-m · fix-419-m
> status: done
> closed: 2026-10-14
> created: 2026-10-14

## Síntoma

Con el dashboard de secretaria abierto, al registrar un pago (desde el mismo dashboard o desde otra
sesión) "Ingresos Mes" sube solo, pero "Alertas Importantes" no cambia: no aparece "N pagos
registrados hoy" y, si el pago salda la deuda, "N pagos pendientes" sigue contando a ese alumno.
El chip "alertas urgentes" del hero queda igual de desfasado. Todo se corrige recién al salir y
volver al dashboard.

## Root Cause

`DashboardAlertsFacade` no tiene canal Realtime ni nadie le pide recargar: solo se carga en
`initialize()`, al entrar al dashboard o cambiar de sede. El canal `dashboard-realtime` de
`DashboardFacade` sí recibe esos eventos, pero recarga solo los KPIs, las clases y la actividad.

## Fix

- `DashboardFacade` expone `liveUpdates`, un contador que sube cada vez que termina una recarga
  pedida por un evento Realtime. Usa el mismo agrupamiento de eventos de `fix-407-m`: una ráfaga
  de eventos produce una recarga, no una por evento. Las recargas por re-entrada SWR no lo suben.
- `DashboardAlertsFacade.refreshSilently()` pasa a ser público.
- `SecretariaDashboardComponent` refresca las alertas en silencio cuando `liveUpdates` cambia
  después de montarse (no al montarse: ahí ya las carga `initialize()`).

## Acceptance Criteria

- [x] AC1 — Una recarga provocada por un evento Realtime sube `liveUpdates` una vez, aunque hayan
  llegado varios eventos mientras corría otra carga.
- [x] AC2 — Una recarga por re-entrada SWR no sube `liveUpdates`.
- [x] AC3 — El dashboard de secretaria refresca las alertas cuando `liveUpdates` cambia, y no lo
  hace al montarse con el valor que ya traía.
- [x] AC4 — Con el dashboard abierto, un pago registrado desde otra sesión hace aparecer "pagos
  registrados hoy" sin recargar.

## Regression Test

- `dashboard.facade.spec.ts` → `fix-420-m`
- `secretaria-dashboard.component.spec.ts` → `fix-420-m`
- `e2e/dashboards.spec.ts` → `L04 · O06`

## Verificación (2026-10-14)

- Unit: 3 tests nuevos en `dashboard.facade.spec.ts` (una ráfaga sube el contador una vez por
  recarga; un evento durante la primera carga; la re-entrada SWR no lo sube) y 2 en
  `secretaria-dashboard.component.spec.ts` (no refresca al montarse; refresca con cada cambio).
  Las tres suites del dashboard: 147/147. `tsc` sin errores; `lint:arch` 0 errores.
- E2E `L04 · O06`: con el dashboard de secretaria abierto, otra sesión registra un pago de hoy y
  "1 pago registrado hoy" aparece sin recargar. Sin el cambio del componente el mismo test falla
  (se queda en 0). Junto con O01 · O02 y O03: 7/7 (incluye setup).
