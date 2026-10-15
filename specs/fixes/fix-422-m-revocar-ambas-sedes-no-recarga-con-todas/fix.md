# Fix: al quitarle "ambas sedes" a una secretaria que miraba "Todas", la pantalla sigue con las dos sedes
> id: fix-422-m-revocar-ambas-sedes-no-recarga-con-todas
> refs: fix-395-m-testing-dashboards (caso R07) · spec 0017 (AC-E3)
> status: done
> closed: 2026-10-14
> created: 2026-10-14

## Síntoma

Una secretaria con acceso a ambas sedes tiene el dashboard abierto en "Todas". El admin le quita
el acceso: el selector de sede desaparece, pero los números siguen siendo los de las dos sedes
(197 alumnos activos en vez de los 67 de su sede) hasta que recarga o navega.

## Root Cause

Al revocar el acceso, `AuthFacade.refreshProfile()` llama a `branchFacade.reset()`, que deja la
sede elegida en `null` ("Todas"). Si ya estaba en `null`, el signal no cambia y ningún `effect()`
que recarga por sede se vuelve a ejecutar. Las cargas ya resuelven la sede propia
(`resolveBranchScope` ignora el selector sin el acceso), pero nadie las vuelve a pedir.

## Fix

Al revocar el acceso, la sede elegida pasa a ser la propia de la secretaria
(`branchFacade.selectBranch(updated.branchId)`): desde "Todas" o desde la otra sede el signal
cambia y las pantallas recargan con su sede. Si ya miraba su propia sede, no cambia nada y no hace
falta recargar.

## Acceptance Criteria

- [x] AC1 — Revocar el acceso con "Todas" elegida deja elegida la sede propia.
- [x] AC2 — Revocar el acceso con la otra sede elegida deja elegida la sede propia.
- [x] AC3 — Con el dashboard abierto en "Todas", al revocar el acceso los KPIs pasan a los de su
  sede sin recargar.

## Regression Test

- `auth.facade.spec.ts` → `fix-422-m`
- `e2e/dashboards.spec.ts` → `R07`

## Verificación (2026-10-14)

- Unit: `auth.facade.spec.ts`, 2 tests nuevos (desde "Todas" y desde la otra sede). Con
  `branch.facade.spec.ts`: 85/85. `tsc` sin errores.
- E2E `R07`: la secretaria multi-sede con el dashboard en "Todas"; otra sesión le quita el acceso:
  el selector desaparece y "Alumnos Activos" pasa al de su sede. Antes del fix el mismo test falló
  con 197 (las dos sedes) en vez de 67. `personal-dos-sesiones.spec.ts` N01 + N02 (otorgar y
  revocar en caliente) sigue en verde. El test devuelve el acceso al terminar.
- Es lo que ya pedía el AC-E3 de `0017-b` ("se re-ancla a su `branch_id`").
