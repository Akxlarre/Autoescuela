# Fix: el KPI "Vehículos" de secretaria no cuenta los vehículos de "ambas sedes"
> id: fix-411-m-kpi-vehiculos-secretaria-sin-ambas-sedes
> refs: fix-395-m-testing-dashboards (caso K09, sospecha S9) · spec 0004-m (AC7)
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

Un vehículo marcado "ambas sedes" aparece en Flota con cualquier sede (spec 0004-m, AC7) y en
"Operación de hoy" del ejecutivo, pero el KPI "Vehículos" y el "Total flota" del dashboard de
secretaria solo lo cuentan en su sede de origen.

## Root Cause

`DashboardFacade.fetchRealDashboardData()` filtra los vehículos con `branch_id = <sede>` exacto. Flota
(`flota.facade.ts`) usa `branch_id = <sede> OR both_branches = true`.

## Fix

La consulta de vehículos del dashboard usa el mismo filtro que Flota.

## Acceptance Criteria

- [x] AC1 — Con una sede elegida, la consulta de vehículos incluye los de `both_branches = true`.
- [x] AC2 — Con "Todas", no se filtra.

## Regression Test

- `dashboard.facade.spec.ts` → `KPI "Vehículos" incluye los de ambas sedes (fix-411-m)`

## Verificación (2026-10-13)

- Unit: `dashboard.facade.spec.ts` 40/40, 2 tests nuevos (con sede: filtro
  `branch_id.eq.N,both_branches.eq.true`; con "Todas": sin filtro). `tsc` sin errores.
- En dev no hay vehículos marcados "ambas sedes", así que el número en pantalla no cambia (sede 1:
  9). El test E2E "R01 · R02 · K09" compara el KPI contra la flota contando los de ambas sedes.
