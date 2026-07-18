# Hotfix: Admin Slim Complete — Full Standardization
> id: hotfix-011-b-admin-slim-complete
> status: done
> created: 2026-06-19

## Problema
hotfix-010 dejó 2 errores de build (app-kpi-card-variant aún en template de profesional-archivo y vehicle-maintenances sin migrar) y no cubrió todas las páginas admin. Varias páginas tienen el hero envuelto en `<div class="bento-hero">` en vez de ser hijo directo del bento-grid, rompiendo la posición uniforme.

## Cambios
- **Archivo:** `features/admin/profesional-archivo/admin-profesional-archivo.component.ts` — migrar KPIs condicionales al hero strip, eliminar KpiCardVariantComponent
- **Archivo:** `features/admin/flota/vehicle-maintenances/vehicle-maintenances.component.ts` — migrar maintenanceKpis al hero strip density="slim", eliminar KpiCardVariantComponent
- **Archivo:** Todas las páginas admin restantes — aplicar density="slim", eliminar wrappers div.bento-hero, migrar KPIs
- **Archivo:** `docs/SLIM-MIGRATION-GUIDE.md` — documentar el canon de migración aprendido
