# Hotfix: Fix required input actions missing on SectionHeroComponent in historial-cuadraturas-content
> id: hotfix-012-b-historial-cuadraturas-required-actions
> status: done
> closed: 2026-06-19
> created: 2026-06-19

## Problema
`SectionHeroComponent.actions` es un input required. Tras migrar `historial-cuadraturas-content`
a `density="slim"` y eliminar el binding `[actions]="heroActions()"`, el build falla con
NG8008: Required input 'actions' from component SectionHeroComponent must be specified.

## Cambios
- **Archivo:** `src/app/shared/components/historial-cuadraturas-content/historial-cuadraturas-content.component.ts` — agregar `[actions]="[]"` al `app-section-hero`
