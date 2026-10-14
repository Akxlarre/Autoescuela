# Fix: un error de carga en el dashboard de secretaria se ve como ceros y "todo en orden"
> id: fix-405-m-dashboard-secretaria-error-de-carga-como-ceros
> refs: fix-395-m-testing-dashboards (caso A09, sospecha S15) · facades.md (capturar errores y exponer un signal de error)
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

Secretaria de la sede 1, con las llamadas a la BD cortadas (2026-10-13): el dashboard muestra
"Alumnos Activos 0", "Ingresos Mes $0", "Vehículos 0", "Sin clases actuales", "Sin actividad
reciente" y una alerta **falsa** "Caja sin cerrar". Nada indica que la carga falló. Con las alertas
pasa lo mismo en el dashboard ejecutivo ("Todo en orden") y en el drawer ("Todo al día").

## Root Cause

`supabase-js` no lanza cuando una consulta falla: devuelve `{ data: null, count: null, error }`.

- `DashboardFacade.fetchRealDashboardData()` y `fetchLiveClasses()` no miran `error`: usan
  `count ?? 0` y `data ?? []`, así que una falla se convierte en ceros. `initialize()` nunca llega
  a su `catch`, y de todas formas `SecretariaDashboardComponent` no lee `error()`.
- `DashboardAlertsFacade`: cada `check…()` trata el error como "0 resultados" y devuelve `[]`.
  `checkUnclosedCash()` además interpreta "no pude contar cierres" como "no hay cierre".

## Fix

- `DashboardFacade`: una consulta fallida de la carga lanza. `initialize()` deja el error en
  `error()`; `refreshSilently()` lo sigue tragando (los datos anteriores quedan a la vista).
- `SecretariaDashboardComponent`: si la primera carga falla, muestra "No se pudo cargar el panel"
  con "Reintentar" en vez de los paneles en cero.
- `DashboardAlertsFacade`: cada consulta fallida lanza. Las revisiones que sí respondieron se
  muestran; si alguna falló, `loadProblem()` lo dice. Los tres lugares que listan alertas
  (dashboard de secretaria, ejecutivo, drawer) muestran ese aviso en vez de "Todo en orden".

## Acceptance Criteria

- [x] AC1 — Si falla la primera carga del dashboard de secretaria, se ve "No se pudo cargar el
      panel" y "Reintentar"; no se ven KPIs en 0 ni "Sin clases actuales".
- [x] AC2 — "Reintentar" vuelve a cargar; con la red de vuelta, el dashboard aparece normal.
- [x] AC3 — Si falla un refresco en segundo plano con datos ya cargados, los datos siguen a la vista.
- [x] AC4 — Si falla la revisión de alertas, no aparece "Caja sin cerrar" ni "Todo en orden": se
      avisa que las alertas no se pudieron revisar.
- [x] AC5 — Si solo fallan algunas revisiones, se muestran las alertas que sí respondieron junto
      con el aviso.

## Regression Test

- `dashboard.facade.spec.ts` → `errores de consulta (fix-405-m)`
- `dashboard-alerts.facade.spec.ts` → `errores de consulta (fix-405-m)`
- `secretaria-dashboard.component.spec.ts` → `error de carga (fix-405-m)`

## Verificación (2026-10-13)

- Unit: 143/143 en los seis specs de los dashboards (`dashboard.facade`, `dashboard-alerts.facade`,
  `secretaria-dashboard.component`, `alerts-drawer.component`, `dashboard.component`), 12 tests
  nuevos. Un test de `fix-404-m` cambió de expectativa: una sola revisión fallida ya no es un error
  total sino "lista incompleta". `tsc` sin errores.
- Navegador, secretaria de la sede 1 con `rest/v1` cortado: "No se pudo cargar el panel · Error al
  cargar datos del dashboard. Revisa tu conexión y vuelve a intentarlo. · Reintentar". Sin KPIs en
  0, sin "Sin clases actuales" y sin "Caja sin cerrar".
- Con la red de vuelta, "Reintentar" carga el dashboard completo (67 alumnos, 9 vehículos) y no
  aparece ningún aviso.
- Solo `cash_closings` cortado: se ven las otras 5 alertas, sin "Caja sin cerrar", y el drawer
  dice "No se pudieron revisar todas las alertas. Puede faltar alguna."
- Admin con todo normal: sin aviso en "Operación de hoy" (ninguna revisión falla por permisos).
