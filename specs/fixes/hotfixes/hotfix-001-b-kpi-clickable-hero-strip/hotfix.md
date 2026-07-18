# Hotfix: KPI interactivo en hero strip
> id: hotfix-001-b-kpi-clickable-hero-strip
> status: done
> closed: 2026-06-30
> created: 2026-06-29

## Problema
El KPI "Por Vencer" vive fuera del hero como un `bento-square` independiente porque `SectionHeroKpi` no soporta interacción. No hay forma de representar un KPI clickeable en el strip del header.

## Cambios
- **Archivo:** `src/app/core/models/ui/section-hero.model.ts` — agregar campo `clickable?: boolean` a `SectionHeroKpi`
- **Archivo:** `src/app/shared/components/section-hero/section-hero.component.ts` — agregar output `kpiClick`, renderizar KPIs con `clickable: true` como `<button>` con hover en modo slim
- **Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` — mover "Por Vencer" a `alumnosKpis()` con `clickable: true`, escuchar `(kpiClick)`, eliminar el `bento-square` suelto con `app-action-kpi-card`
