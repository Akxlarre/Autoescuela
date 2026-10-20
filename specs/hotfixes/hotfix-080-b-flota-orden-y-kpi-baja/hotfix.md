# Hotfix: Flota se ordena por patente y tiene un KPI "De Baja"
> id: hotfix-080-b-flota-orden-y-kpi-baja
> refs: ASG-i-032 (checklist 032, B11 y C04; decisiones del owner 2026-10-16)
> status: done
> created: 2026-10-16

## Problema
- **B11:** el listado salía por id (orden de creación). Decisión: por patente.
- **C04:** los vehículos "Fuera de servicio" no aparecían en ningún KPI. Decisión: KPI "De Baja".

## Cambios
- **Archivo:** `src/app/core/facades/flota.facade.ts` (+ spec) — `filteredVehicles` ordenado por
  patente; `kpis.outOfService`.
- **Archivo:** `src/app/core/models/ui/vehicle-table.model.ts` — `FlotaKpis.outOfService`.
- **Archivo:** `src/app/shared/components/flota-list-content/flota-list-content.component.ts` — KPI
  "De Baja" en el hero (admin y secretaria).

## Verificación
- [x] vitest del facade.
- [x] e2e de Flota en verde (el de KPIs compara "De Baja" con la BD).
