# Fix: La secretaria no puede crear instructores (o los intenta crear en la sede de otro usuario)
> id: fix-201-b-secretaria-crea-instructor-sede
> refs: ASG-i-034 (sospecha S3, confirmada en fix-197-b) · spec 0004-m (AC2)
> status: done
> created: 2026-10-07

## Root Cause
[Confirmado leyendo el código el 2026-10-07.] En `admin-instructor-crear-drawer` la sede sale
**solo** de `branchFacade.selectedBranchId()` (el selector del topbar) y el campo Sede se muestra
**solo al admin**:
- Secretaria sin grant: su topbar no tiene selector → `null` → el formulario nunca es válido y
  "Crear instructor" no hace nada, sin mensaje. Si en ese navegador quedó guardada la sede de otro
  usuario (`localStorage`), intenta crear en **esa** sede (desde fix-198-b el servidor responde 403).
- Secretaria multi-sede con "Todas": tampoco ve el campo → no puede elegir sede.

## ACs Afectados
- **spec 0004-m AC2** (la secretaria crea instructores en su sede).
- **F1:** secretaria sin grant → la sede del formulario es **su** sede, siempre (ignora el topbar
  y lo guardado en `localStorage`); no ve el campo.
- **F2:** admin y secretaria multi-sede → ven el campo Sede, precargado con la del topbar si hay una.
- **F3:** secretaria sin sede asignada → mensaje "Tu usuario no tiene una sede asignada…" en vez
  de un botón que no hace nada.

## Cambio
- `src/app/core/utils/instructor-create-branch.utils.ts` (+ spec) — función pura que decide si se
  elige sede y cuál es la inicial.
- `src/app/features/admin/instructores/admin-instructor-crear-drawer.component.ts` — la usa.

## Test de Regresión
- `npx vitest run src/app/core/utils/instructor-create-branch.utils.spec.ts`
- `npx playwright test e2e/instructores-alta.spec.ts` contra el build de producción

## Resultado (2026-10-07)
- `instructor-create-branch.utils.spec.ts` 4/4. `npm run test:ci` 3432 ✓, `ng build` ✓, `lint:arch` 0 errores.
- `e2e/instructores-alta.spec.ts` (nuevo, build de producción): secretaria sede 1 con la sede 2
  guardada en el navegador → no ve el campo Sede y el alta manda `branchId: 1`. **Sin el fix el
  mismo test falla: manda `branchId: 2`.** La llamada se intercepta: no se crea nada.
