# Hotfix: Migrate KPI bento-square cells to hero strip in 5 shared content components
> id: hotfix-013-b-kpi-strip-migration-shared-content
> status: done
> closed: 2026-06-19
> created: 2026-06-19

## Problema
Los shared content components del portal admin migraron a `density="slim"` pero dejaron los KPIs como celdas `bento-square` separadas con `app-kpi-card-variant`. El patrón canónico es moverlos al `[kpis]` strip del hero slim.

## Cambios
- **Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` — mover KPIs al strip `[kpis]` del hero, eliminar celdas bento-square con kpi-card-variant
- **Archivo:** `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts` — mover 4 KPIs al strip del hero
- **Archivo:** `src/app/shared/components/certificacion-clase-b-content/certificacion-clase-b-content.component.ts` — mover 4 KPIs al strip del hero
- **Archivo:** `src/app/shared/components/servicios-especiales-content/servicios-especiales-content.component.ts` — mover KPIs al strip del hero (mix de kpi-card-variant + inline kpi-value)
- **Archivo:** `src/app/shared/components/flota-list-content/flota-list-content.component.ts` — mover 3 kpi-card-variant al strip; mantener action-kpi-card en bento-square (sin equivalente en strip)
