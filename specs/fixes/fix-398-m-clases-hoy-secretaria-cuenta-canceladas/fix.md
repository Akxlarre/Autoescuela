# Fix: "Clases Hoy" del dashboard de secretaria cuenta clases canceladas y reservas
> id: fix-398-m-clases-hoy-secretaria-cuenta-canceladas
> refs: fix-395-m-testing-dashboards (casos K04, K06, K10, sospecha S5) · DG-050
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

Dashboard de secretaria (sede 1 de dev, 2026-10-13): el KPI "Clases Hoy" dice 17 y el chip del
hero "17 clases programadas", mientras el panel "Clases Actuales" dice "Sin clases actuales". Las
17 clases de hoy están canceladas.

## Root Cause

En `DashboardFacade.fetchRealDashboardData()`, las consultas del KPI (`classesQuery`, hoy, y
`classesYesterdayQuery`, para la tendencia "vs ayer") cuentan `class_b_sessions` por fecha sin
filtrar estado ni matrícula: entran las `cancelled`, las `reserved` de matrículas en borrador
(DG-050) y las de matrículas no activas. El panel "Clases Actuales" (`fetchLiveClasses`) sí filtra
`VALID_CLASS_B_SESSION_STATUSES` y matrícula activa, así que los dos números de la misma pantalla
no coinciden.

## Fix

Las dos consultas del KPI usan el mismo criterio que el panel: estado en
`VALID_CLASS_B_SESSION_STATUSES` y `enrollments.status = 'active'`.

## Acceptance Criteria

- [x] AC1 — "Clases Hoy" y el chip "N clases programadas" no cuentan clases `cancelled` ni
      `reserved`, ni clases de matrículas no activas.
- [x] AC2 — La tendencia "vs ayer" compara con el mismo criterio.
- [x] AC3 — "Clases Hoy" coincide con la cantidad de clases de hoy del panel "Clases Actuales".

## Regression Test

- `dashboard.facade.spec.ts` → `KPI "Clases Hoy" usa el criterio del panel (fix-398-m)`

## Verificación (2026-10-13)

- Unit: `dashboard.facade.spec.ts` 24/24 (el test nuevo, rojo → verde).
- Navegador, secretaria de la sede 1 con las 17 clases de hoy canceladas: "Clases Hoy" pasó de 17
  a 0 y el chip a "0 clases programadas"; coincide con "Sin clases actuales".
