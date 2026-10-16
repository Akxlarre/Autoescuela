# Hotfix: Mantenimientos muestra montos en formato inglés y fechas crudas
> id: hotfix-086-b-mantenimientos-formato-chileno
> refs: ASG-i-032 (checklist 032, M10, L08 y L09)
> status: closed
> created: 2026-10-16

## Problema
Con un servicio de $1.500.000 la página de mantenimientos del vehículo decía "$1,500,000
invertidos" (separador inglés), los KPIs "$1500000" y "1200 km" (sin separador) y "1 servicios";
la tabla de abajo sí decía "$1.500.000". Las fechas de la tabla y de las tarjetas de documentos
salían crudas ("2026-10-16").

## Cambios
- **Archivo:** `src/app/core/utils/maintenance-format.utils.ts` (+ spec) — `formatKm()` y
  `servicesLabel()`.
- **Archivo:** `src/app/features/admin/flota/vehicle-maintenances/vehicle-maintenances.component.ts` —
  chips y KPIs con `formatCLP` / `formatKm`, singular para 1 servicio, fechas con el pipe
  `chileDate` (dd MMM yyyy).

## Verificación
- [x] vitest del util.
- [x] e2e `flota-real.spec.ts` M10/L08 sobre el servicio real de ZZ4199.
