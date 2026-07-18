# Hotfix: Slim Hero Responsive Row1 — Layout 2-filas en mobile, chips siempre visibles
> id: hotfix-006-b-slim-hero-responsive-row1
> status: done
> closed: 2026-06-18
> created: 2026-06-18

## Problema
En el slim hero, los chips tienen `hidden md:flex` (desaparecen en <768px) y row1 es un
flex plano sin columna en mobile — el título se trunca agresivamente y los chips son
invisibles en 375px y 640px. Con múltiples botones + badge, row1 se llena sin breathing room.

## Cambios
- **Archivo:** `src/app/shared/components/section-hero/section-hero.component.ts` — Reemplazar slim row1 con layout `flex flex-col sm:flex-row sm:items-center`: LEFT slot (back+icon+title) + RIGHT slot (chips siempre visibles con `flex-wrap` + ng-content + acciones). Quitar `hidden md:flex` de chips.
