# Hotfix: Migrar KPI cards al hero slim en liquidaciones y agenda-semanal
> id: hotfix-002-b-migrate-kpis-to-slim-hero
> status: done
> closed: 2026-06-18
> created: 2026-06-18

## Problema
`liquidaciones-content` y `agenda-semanal` renderizan los KPIs como celdas `bento-square`
separadas del hero. Con `density="slim"`, el hero ya tiene un KPI strip integrado (`[kpis]`),
por lo que los `app-kpi-card-variant` sueltos son redundantes y ocupan espacio innecesario.

## Cambios
- **Archivo:** `docs/SLIM-MIGRATION-GUIDE.md` — agregar sección "Transformar KPI cards al KPI strip"
- **Archivo:** `src/app/shared/components/liquidaciones-content/liquidaciones-content.component.ts` — añadir `heroKpis` computed, pasar `[kpis]` y `[loading]` al hero, eliminar los 3 bloques `bento-square` de KPIs, quitar `KpiCardVariantComponent` de imports
- **Archivo:** `src/app/shared/components/agenda-semanal/agenda-semanal.component.ts` — añadir `heroKpis` computed, cambiar hero a `density="slim"` con `[kpis]` y `[loading]`, eliminar bloque `@if (showKpis())`, quitar `KpiCardVariantComponent` de imports y `kpiGridRef`
