# Fix: Ex-Alumnos, Pagos y Certificación B muestran datos de la sede anterior tras un cambio rápido de sede
> id: fix-195-b-ex-alumnos-respuestas-fuera-de-orden
> refs: ASG-i-037 (caso D06 del checklist 037, encontrado por `e2e/transversal-shell.spec.ts` en fix-190-b) · spec 0005-m · `facades.md` §7
> status: done
> created: 2026-10-06

## Root Cause
[Confirmado en vivo: admin A → B → A rápido con las respuestas de B demoradas → la pantalla queda en
"Autoescuela Chillán" mostrando los 8 egresados de Conductores (A tiene 9); en otra corrida el badge
desaparece. Con el test endurecido (espera a que no quede consulta en vuelo) caen también Pagos
—"con deuda" 43 (B) en vez de 26 (A)— y Certificación B —"Pendientes" 71 (B) en vez de 76 (A)—;
Dashboard, que sí tiene guard, pasa.] Los tres facades son branch-scoped y no usan
`createRequestGuard()` (obligatorio desde spec 0005-m, `facades.md` §7): aplican la respuesta
aunque ya se haya pedido otra sede después. Además, el `finally` de la carga vieja apaga
`isLoading` (y en Ex-Alumnos marca `_initialized`/`_lastBranchId` con la sede vieja).

Misma causa raíz en los tres → un solo fix. El resto de los facades branch-scoped sin guard (~19)
no se tocan acá: no están reproducidos; van a una asignación aparte.

## ACs Afectados
- **spec 0005-m** (facades sin respuestas stale): una respuesta de una sede anterior nunca pisa el
  estado de la sede vigente.
- **F1:** tras A → B → A con B demorada, Ex-Alumnos (lista + conteo anual), Pagos (los 7
  indicadores) y Certificación B (alumnos + log) muestran A.
- **F2:** `isLoading` queda en `false` y la próxima visita a A es un refresco silencioso (SWR), no
  una recarga con skeleton.

## Cambio
- `src/app/core/facades/ex-alumnos.facade.ts`, `pagos.facade.ts`, `certificacion-clase-b.facade.ts`
  (+ specs) — un guard por facade, compartido por la carga completa y el refresco SWR (y `reload()`
  en Certificación); el resultado y los flags solo los aplica la llamada vigente.

## Test de Regresión
- `npx vitest run src/app/core/facades/ex-alumnos.facade.spec.ts src/app/core/facades/pagos.facade.spec.ts src/app/core/facades/certificacion-clase-b.facade.spec.ts`
- `npx playwright test e2e/transversal-shell.spec.ts -g D06 --workers=1` contra el build de producción (rama fix-190-b).

## Resultado (2026-10-07)
- Vitest: `ex-alumnos` 23/23, `pagos` 18/18, `certificacion-clase-b` 29/29. Los tests nuevos de la
  carrera fallan sin el cambio (quedan los datos de la sede 2) y pasan con él.
- `npm run test:ci` 3374 ✓ (una corrida previa tuvo 1 falla intermitente ajena a estos specs; no
  se repitió), `ng build` ✓, `lint:arch` 0 errores.
- Playwright D06 (`--workers=1 --repeat-each=2`, build de producción con el fix): **8/8** — Pagos,
  Ex-Alumnos, Certificación B y Dashboard terminan mostrando A.
