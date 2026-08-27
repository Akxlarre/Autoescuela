# Hotfix: Dashboard secretaria — KPI "Ingresos Mes" muestra el trend sin signo %
> id: hotfix-094-m-dashboard-secretaria-kpi-trend-sin-porcentaje
> refs: —
> status: done
> closed: 2026-08-27
> created: 2026-08-27

## Problema
El KPI "Ingresos Mes" del dashboard de secretaria muestra "▲ 88 vs mes pasado" en vez de
"▲ 88% vs mes pasado". El `88` es el porcentaje de variación vs. el mes anterior
(`dashboard.facade.ts` lo calcula y lo marca con `trendSuffix: '%'`), pero
`secretaria-dashboard.component.ts` no propaga `trendSuffix` al mapear los KPIs del facade
a `SectionHeroKpi`. El dashboard admin (`dashboard.component.ts`) sí lo propaga.

## Cambios
- **Archivo:** `src/app/features/secretaria/dashboard/secretaria-dashboard.component.ts` — agregar `trendSuffix: k.trendSuffix` al objeto mapeado a `SectionHeroKpi` (junto a `trend` y `trendLabel`)
