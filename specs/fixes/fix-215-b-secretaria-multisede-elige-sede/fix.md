# Fix: La secretaria con acceso multisede ve el campo Sede al crear un instructor, pero bloqueado
> id: fix-215-b-secretaria-multisede-elige-sede
> refs: ASG-i-034 (casos D04/D05, §5) — decisión del owner 2026-10-07: la secretaria multisede elige entre sus sedes
> status: done
> created: 2026-10-07

## Root Cause
[Confirmado con e2e el 2026-10-07.] fix-201-b hizo que Crear instructor muestre el campo Sede a quien
puede elegir sede (admin o secretaria con `can_access_both_branches`), y `create-instructor` ya la
autoriza en cualquier sede. Pero `app-branch-scope-selector` deshabilita el campo para todo rol que
no sea admin (`isSedeDisabled(role)`). Con "Todas las sedes" en el topbar el campo queda vacío y
bloqueado: no puede crear (D05). Con una sede elegida queda fija en esa (D04).

## ACs Afectados
- **F1:** con el grant, la secretaria puede elegir la sede en Crear instructor (partiendo de la del topbar).
- **F2:** sin el grant, la secretaria sigue sin elegir (su sede, campo oculto, fix-201-b).
- **F3:** "Ambas" sigue siendo solo de admin (AC2 de 0004-m), con o sin grant.

## Cambio
- `src/app/core/utils/branch-scope-ui.utils.ts` (+ spec) — `isSedeDisabled(role, canAccessBothBranches)`.
- `src/app/shared/components/branch-scope-selector/branch-scope-selector.component.ts` — input `canAccessBothBranches`.
- `src/app/features/admin/instructores/admin-instructor-crear-drawer.component.ts` — se lo pasa.

## Test de Regresión
- `npx vitest run src/app/core/utils/branch-scope-ui.utils.spec.ts`
- `npx playwright test e2e/instructores-alta-multisede.spec.ts --workers=1`

## Progreso
- [x] util 9/9 (rojo → verde); el selector recibe `canAccessBothBranches` y Crear instructor se lo pasa. `ng build` ✓, `lint:arch` 0 errores (182).
- [x] e2e (crear interceptado, no se crea nada): la secretaria multisede con "Todas" elige "Conductores Chillán", no ve "Ambas", y la función recibe `branchId: 2`. 1/1. Antes el campo quedaba bloqueado y vacío.
