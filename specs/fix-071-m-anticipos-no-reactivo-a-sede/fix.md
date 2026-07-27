# Fix: Anticipos no reacciona al cambio de sede en el topbar
> id: fix-071-m-anticipos-no-reactivo-a-sede
> refs: —
> status: done
> closed: 2026-07-27
> created: 2026-07-27

## Root Cause

`AnticiposFacade` (`src/app/core/facades/anticipos.facade.ts`) no inyecta `BranchFacade` ni aplica
ningún filtro de sede en `fetchData()` — trae TODOS los instructores y anticipos de TODAS las
sedes, siempre, sin importar la sede seleccionada en el topbar. Además,
`AdminContabilidadAnticiposComponent.ngOnInit()` solo llama a `facade.initialize()` una vez, sin un
`effect()` que trackee `branchFacade.selectedBranchId()` (patrón ya usado en
`InstructoresFacade`/`AdminInstructoresComponent` y `AdminContabilidadReportesComponent`) — así que
ni siquiera al cambiar de sede se dispara un refetch.

Viola la regla de `facades.md` §7 (Facades Multi-Sede): un Facade que maneja datos con scope de
sede debe inyectar `BranchFacade`, leer `selectedBranchId()` en cada fetch y aplicar el filtro
condicionalmente. `AnticiposFacade` no está en la tabla de excepciones (no tiene su propio scope
tipo `instructor_id`/`recipient_id`) — debería estar en la lista de Facades que SÍ aplican filtro,
igual que `AdminAlumnosFacade`, `FlotaFacade`, etc.

## ACs Afectados

- Ninguno — fix autónomo, sin spec asociada.

## Cambio

- **Archivo:** `src/app/core/facades/anticipos.facade.ts`
  - Inyectar `AuthFacade`/`BranchFacade` (ya se inyecta `AuthFacade`) y agregar
    `resolveBranchScope()` (mismo util que usa `InstructoresFacade`) para calcular el `branch_id`
    efectivo según rol (admin respeta el selector, secretaria queda anclada a su sede).
  - Ambas queries de `fetchData()` (`instructor_advances` y `instructors`) deben filtrar por
    `users.branch_id` (vía el join `instructors!inner(...).users!inner(...)`) cuando el branch
    efectivo no sea `null`.
  - `initialize()` debe comparar el branch efectivo actual contra el último usado (mismo patrón
    `_lastBranchId` de `InstructoresFacade`) para no perder el SWR en revisitas sin cambio de sede.
- **Archivo:** `src/app/features/admin/contabilidad-anticipos/admin-contabilidad-anticipos.component.ts`
  - Reemplazar `ngOnInit() { this.facade.initialize(); }` por un `effect()` en el constructor que
    trackee `branchFacade.selectedBranchId()` y llame a `facade.initialize()` (mismo patrón que
    `AdminInstructoresComponent`/`AdminContabilidadReportesComponent`).

## Test de Regresión

- `anticipos.facade.spec.ts > AnticiposFacade — filtro de sede (fix-071)`:
  - `aplica .eq(branch_id) en ambas queries cuando el admin tiene una sede seleccionada` ✓
  - `NO filtra por sede cuando el admin selecciona "Todas las sedes" (null)` ✓
  - `re-fetchea al cambiar de sede seleccionada (SWR con branch tracking)` ✓
- Suite completa (`npm run test:ci`): 1450/1450 en verde (23/23 en `anticipos.facade.spec.ts`, incluyendo los 3 tests nuevos).
- `npm run lint:arch`: 0 errores.
- Verificación visual: NO ejecutada con Playwright MCP en esta sesión — el usuario (Matías) indicó que él verificará el resultado directamente en `ng serve`.
