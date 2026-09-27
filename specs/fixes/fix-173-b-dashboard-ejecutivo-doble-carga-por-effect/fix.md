# Fix: Dashboard ejecutivo recarga dos veces al cambiar el período
> id: fix-173-b-dashboard-ejecutivo-doble-carga-por-effect
> refs: 0044-b-dashboard-ejecutivo-admin
> status: done
> closed: 2026-09-27
> created: 2026-09-27

## Root Cause
El `effect()` de `DashboardComponent` que recarga al cambiar de sede llama
`facade.reload()` y `alertsFacade.initialize()` dentro de su cuerpo. Ambos leen signals de forma
síncrona antes de su primer `await` (`reload()` lee `hasData()`/`_range()`/`selectedBranchId()`),
así que el effect queda suscrito también a esos signals. Cambiar el período (`applyRange()`
escribe `_range`) vuelve a disparar el effect: cada cambio de período lanza 2 rondas de 7 RPC y
reinicializa las alertas. El request guard descarta la primera ronda (los números mostrados son
correctos), pero la BD hace el doble de trabajo.

## ACs Afectados
- AC1 / AC2 (0044-b): cambiar período dispara una sola carga; solo el cambio de sede re-dispara
  el effect.

## Cambio
- **Archivo:** `src/app/features/dashboard/dashboard.component.ts`
- **Qué cambia:** el effect solo rastrea `branchFacade.selectedBranchId()`; las llamadas a
  `facade.reload()` y `alertsFacade.initialize()` van dentro de `untracked()`.

## Test de Regresión
- `src/app/features/dashboard/dashboard.component.spec.ts > fix-173-b: cambiar el período no re-dispara el effect de sede` ✓
