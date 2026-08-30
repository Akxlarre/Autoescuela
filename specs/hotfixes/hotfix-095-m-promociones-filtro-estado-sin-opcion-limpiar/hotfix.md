# Hotfix: Promociones — filtro de estado sin opción para limpiar
> id: hotfix-095-m-promociones-filtro-estado-sin-opcion-limpiar
> refs: fix-229-m-promociones-profesionales-lista-paginada-en-vez-de-cards
> status: done
> closed: 2026-08-29
> created: 2026-08-29

## Problema
El `p-select` de "Todos los estados" en `AdminProfesionalPromocionesComponent` no tiene
forma de volver al estado por defecto (sin filtro): una vez que eliges Planificada / En
curso / Finalizada / Cancelada, no hay opción "Todas" ni botón de limpiar.

## Cambios
- **Archivo:** `src/app/features/admin/profesional-promociones/admin-profesional-promociones.component.ts` — agregar `[showClear]="true"` al `p-select` de estado (patrón ya usado en el resto de la app). Al limpiar, `filtroEstado` vuelve a `null` y `filteredPromociones` deja de filtrar.
