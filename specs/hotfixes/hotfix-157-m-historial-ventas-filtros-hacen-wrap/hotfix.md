# Hotfix: Los filtros del Historial de ventas se salen de su card
> id: hotfix-157-m-historial-ventas-filtros-hacen-wrap
> refs: fix-429-m-testing-servicios-especiales (casos I13 / O02)
> status: in_progress
> created: 2026-10-15

## Problema
En el drawer "Historial de Ventas" (1440 px, drawer de ~640 px), la fila servicio + período +
"Limpiar filtros" no hace wrap: "Limpiar filtros" sobresale del borde de la card.

## Cambios
- **Archivo:** `src/app/features/admin/servicios-especiales/historial-ventas-drawer.component.ts` — la fila de filtros hace `flex-wrap` y el select de servicio crece con `flex-1` y un ancho mínimo (`min-w-48`): si no cabe todo, período y "Limpiar filtros" pasan a la línea siguiente.
