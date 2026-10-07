# Fix: Ex-Alumnos muestra los egresados de la sede anterior tras un cambio rápido de sede
> id: fix-195-b-ex-alumnos-respuestas-fuera-de-orden
> refs: ASG-i-037 (caso D06 del checklist 037, encontrado por `e2e/transversal-shell.spec.ts` en fix-190-b) · spec 0005-m · `facades.md` §7
> status: in_progress
> created: 2026-10-06

## Root Cause
[Confirmado en vivo: admin A → B → A rápido con las respuestas de B demoradas → la pantalla queda en
"Autoescuela Chillán" mostrando los 8 egresados de Conductores (A tiene 9); en otra corrida el badge
desaparece.] `ExAlumnosFacade` es branch-scoped pero no usa `createRequestGuard()` (obligatorio
desde spec 0005-m, `facades.md` §7): `loadEgresadosList()` y el conteo anual de `loadStatistics()`
aplican la respuesta aunque ya se haya pedido otra sede después. Además, el `finally` de la carga
vieja apaga `isLoading` y marca `_initialized`/`_lastBranchId` con la sede vieja.

## ACs Afectados
- **spec 0005-m** (facades sin respuestas stale): una respuesta de una sede anterior nunca pisa el
  estado de la sede vigente.
- **F1:** tras A → B → A con B demorada, la lista y el conteo anual son los de A.
- **F2:** `isLoading` queda en `false` y la próxima visita a A es un refresco silencioso (SWR), no
  una recarga con skeleton.

## Cambio
- `src/app/core/facades/ex-alumnos.facade.ts` (+ spec) — un guard por carga branch-scoped
  (`loadEgresados`, que cubre lista + conteo); el resultado y los flags solo se aplican si la
  llamada sigue vigente.

## Test de Regresión
- `npx vitest run src/app/core/facades/ex-alumnos.facade.spec.ts`
- `npx playwright test e2e/transversal-shell.spec.ts -g "D06.*ex-alumnos"` contra el build de producción (rama fix-190-b).
