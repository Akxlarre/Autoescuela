# Hotfix: flash de "Todas las sedes" antes de restaurar la sede persistida tras F5
> id: hotfix-053-m-branch-flash-inicial-al-restaurar
> status: done
> closed: 2026-07-27
> created: 2026-07-26

## Problema

Tras el fix H-026 (fix-068), la sede persistida en `localStorage` se restaura correctamente al recargar (F5), pero solo después de que `loadBranches()` resuelve el fetch async. Como `_selectedBranchId` arranca en `null`, el topbar muestra "Todas las sedes" por un instante y luego cambia a la sede real — un flash visual, no funcional.

## Cambios

- **Archivo:** `src/app/core/facades/branch.facade.ts` — leer el valor persistido de `localStorage` de forma síncrona al inicializar el signal `_selectedBranchId` (en vez de esperar a `loadBranches()`), para que el primer render ya muestre la sede correcta. `loadBranches()` sigue validando contra la lista real una vez cargada y limpia el valor si ya no existe.
