# Hotfix: Admin Smart Components — migración density="slim"
> id: hotfix-010-b-admin-smart-slim-rollout
> status: done
> created: 2026-06-18

## Problema
17 Smart Components en features/admin/ tienen app-section-hero sin density="slim".

## Cambios
Agregar density="slim" + [loading]="facade.isLoading()" en cada hero.
Páginas con KPIs bento-square separados: mover al [kpis] strip del hero.
