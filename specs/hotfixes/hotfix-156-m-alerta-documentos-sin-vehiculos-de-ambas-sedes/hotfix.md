# Hotfix: la alerta de documentos de vehículos ignora los vehículos de "ambas sedes"
> id: hotfix-156-m-alerta-documentos-sin-vehiculos-de-ambas-sedes
> refs: fix-395-m-testing-dashboards (caso Q01) · fix-411-m
> status: done
> closed: 2026-10-14
> created: 2026-10-14

## Problema
"N Documentos vencidos" y "N Documentos por vencer" filtran por `vehicles.branch_id`. Un vehículo
marcado para ambas sedes solo avisa en su sede de origen, aunque Flota y el KPI "Vehículos" del
dashboard (`fix-411-m`) lo cuentan en las dos.

## Cambios
- **Archivo:** `src/app/core/facades/dashboard-alerts.facade.ts` — con sede elegida, las dos consultas usan `branch_id = sede o both_branches`, como el KPI de vehículos
- **Archivo:** `src/app/core/facades/dashboard-alerts.facade.spec.ts` — test del filtro

## Verificación
- [x] Con sede 2 elegida, las dos consultas a `vehicle_documents` filtran por la sede o por ambas sedes: test nuevo en `dashboard-alerts.facade.spec.ts`, que fallaba antes del cambio; 86/86 junto con `hora-chile.facades.spec.ts`.
- [x] La consulta nueva corre contra la BD de dev con admin y con las dos secretarias: 1 documento vencido en la sede 2 (SOAP de RTRE29), 0 en la sede 1, igual que antes. Hoy ningún vehículo de dev está marcado para ambas sedes.
