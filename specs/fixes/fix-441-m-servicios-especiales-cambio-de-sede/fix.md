# Fix: Servicios especiales se queda con datos de otra sede al cambiarla
> id: fix-441-m-servicios-especiales-cambio-de-sede
> refs: fix-429-m-testing-servicios-especiales (S13, casos M03, M05)
> status: in_progress
> created: 2026-10-15

## Root Cause

Dos huecos en la reactividad por sede del módulo:

1. La pantalla de la secretaria carga una sola vez en `ngOnInit`; solo la del admin tiene el
   `effect` sobre `BranchFacade.selectedBranchId()`. Una secretaria con grant multi-sede cambia de
   sede en el topbar y sigue viendo KPIs y catálogo de la anterior.
2. `ServiciosEspecialesFacade.fetchData()` no tiene `createRequestGuard()` (regla de
   `facades.md`): con un cambio rápido A → B, si la respuesta de A llega después que la de B, la
   pantalla termina mostrando los datos de A con la sede B elegida.

## ACs Afectados

Ninguno — fix autónomo. ACs propios:

- AC-1: la secretaria con grant recarga sola al cambiar de sede, igual que el admin.
- AC-2: una respuesta de una sede anterior que llega tarde no reemplaza a la de la sede actual.

## Cambio

- `features/secretaria/servicios-especiales/secretaria-servicios-especiales.component.ts` —
  `effect` sobre `selectedBranchId()` (mismo patrón que la del admin).
- `core/facades/servicios-especiales.facade.ts` — `createRequestGuard()` en `fetchData()`.

## Test de Regresión

- `secretaria-servicios-especiales.component.spec.ts > recarga al cambiar la sede del topbar`.
- `servicios-especiales.facade.spec.ts > una respuesta vieja (sede anterior) no pisa a la más nueva`.
