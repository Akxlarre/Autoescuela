# Hotfix: Admin slim rollout — páginas Alta prioridad (sin KPIs separados)
> id: hotfix-009-b-admin-slim-rollout-alta
> status: in_progress
> created: 2026-06-18

## Problema
5 páginas admin tienen `app-section-hero` sin `density="slim"` (usan el default "full").
Son las más simples: no tienen kpi-card-variant bento-square separados.

## Cambios
- `admin-alumno-detalle.component.ts` — agregar density="slim" + [loading]="facade.isLoading()"
- `admin-auditoria.component.ts` — agregar density="slim" + [loading]="facade.isLoading()"
- `admin-instructores.component.ts` — agregar density="slim" + [loading]="facade.isLoading()"
- `admin-libro-de-clases.component.ts` — agregar density="slim" + [loading]="facade.isLoading()"
- `admin-profesional-evaluaciones.component.ts` — agregar density="slim" + [loading]="facade.isLoading()"
