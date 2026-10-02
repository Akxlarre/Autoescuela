# Fix: Re-matricular a un egresado deja al admin en la sede del alumno
> id: fix-274-m-rematricular-restaura-sede-del-admin
> refs: fix-264-m (caso W05 de `024b`), fix-040-i, ASG-i-024
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Root Cause

`AdminExAlumnosComponent.reEnroll()` llama a `BranchFacade.selectBranch(egresado.branchId)` para
que el wizard de matrícula arranque en la sede del egresado, y nunca vuelve a la sede que el admin
tenía elegida. Con "Todas las sedes" elegido, re-matricular a un egresado de la sede B deja el
selector del topbar en la sede B: al cerrar el wizard, Ex-Alumnos (y el resto de la app) queda
filtrado por una sede que el admin no pidió.

Revisado en código el 2026-10-01 (el caso W05 no se había ejecutado en navegador).

**Decisión del owner (Matías, 2026-10-01):** al terminar o cancelar una re-matrícula, el selector
vuelve a la sede que el admin tenía elegida.

## ACs Afectados

- AC-1: al cerrar el wizard de una re-matrícula (terminada o cancelada), el selector de sede
  vuelve al valor que tenía antes de re-matricular, incluido "Todas las sedes".
- AC-2: mientras el wizard está abierto, la sede activa es la del egresado (sin cambios).
- AC-3: si el admin sale de Ex-Alumnos con el wizard abierto, la sede también se restaura.
- AC-4: sin una re-matrícula en curso, restaurar no hace nada: no pisa la sede que el admin
  elija después.

## Cambio

- **Archivo:** `src/app/core/facades/branch.facade.ts` — `selectBranchTemporarily(id)` recuerda la
  sede anterior y `restoreTemporaryBranch()` vuelve a ella (una sola vez).
- **Archivo:** `src/app/features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.ts` —
  `reEnroll()` usa el cambio temporal; un `effect()` sobre el drawer restaura la sede al cerrarse,
  y también al destruirse la pantalla.

Fuera de alcance: Ex-Alumnos Profesional (`ASG-i-025`) y la sede que queda elegida cuando el admin
abre "Nueva Matrícula" con "Todas" y elige una en la pantalla de selección (no se decidió).

## Test de Regresión

- `src/app/core/facades/branch.facade.spec.ts > cambio temporal de sede — fix-274-m` ✓ (5 tests)
- `e2e/alumnos-b-ficha.spec.ts > W05` ✓ — admin con "Todas las sedes" re-matricula a un egresado
  de la sede B: con el wizard abierto el selector dice "Conductores Chillán"; al cerrarlo vuelve
  a "Todas las sedes".

## Verificación
Verificado el 2026-10-01: `tsc` de la app sin errores, 31 tests de `branch.facade.spec.ts` en
verde y W05 + W01 · W02 pasan en navegador. Se probó el cierre sin matricular; el caso de
terminar la matrícula completa usa el mismo cierre del drawer y no se ejecutó de punta a punta.
