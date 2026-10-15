# Fix: el dashboard de secretaria no se actualiza al matricular, vender un servicio o cambiar un vehículo
> id: fix-419-m-dashboard-secretaria-realtime-sin-matriculas
> refs: fix-395-m-testing-dashboards (casos O03, L02) · fix-360-m · fix-004-i
> status: done
> closed: 2026-10-14
> created: 2026-10-14

## Síntoma

Con el dashboard de secretaria abierto, matricular a un alumno que ya existe (o completar una
matrícula) no cambia "Alumnos Activos" hasta recargar. Lo mismo con una venta de servicio especial
(entra en "Ingresos Mes") y con un vehículo que cambia de estado ("Vehículos disponibles").

## Root Cause

`DashboardFacade.setupRealtime()` escucha solo `students`, `class_b_sessions` y `payments`. Los KPIs
también leen `enrollments`, `special_service_sales` y `vehicles`, que ya están en la publicación
Realtime desde `fix-360-m`, pero el canal no se suscribe a ellas.

## Fix

Agregar `enrollments`, `special_service_sales` y `vehicles` al canal `dashboard-realtime`, con el
mismo `refreshSilently()` que las otras tablas.

## Acceptance Criteria

- [x] AC1 — El canal del dashboard escucha `enrollments`, `special_service_sales` y `vehicles`
  además de las tablas que ya escuchaba.
- [x] AC2 — Un evento de cualquiera de esas tablas dispara `refreshSilently()`.

## Regression Test

- `dashboard.facade.spec.ts` → `fix-419-m`
- `e2e/dashboards.spec.ts` → `O03 · L02`

## Verificación (2026-10-14)

- Unit: `dashboard.facade.spec.ts`, 4 tests nuevos (tablas del canal y un evento por cada tabla
  nueva). 45/45. `tsc` sin errores; `lint:arch` 0 errores.
- E2E `O03 · L02`: matrícula en borrador sembrada antes de abrir el dashboard de secretaria; otra
  sesión la activa y "Alumnos Activos" pasa de 67 a 68 sin recargar. Sin el fix el mismo test falla
  (se queda en 67). Con O01 · O02 y O05: 7/7 (incluye setup).
