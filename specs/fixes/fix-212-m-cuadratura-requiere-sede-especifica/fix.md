# Fix: Caja Diaria (Cuadratura) operable con "Todas las sedes" seleccionado

> id: fix-212-m-cuadratura-requiere-sede-especifica
> refs: — (encontrado por el usuario durante UAT manual, misma sesión que fix-211-m)
> status: done
> closed: 2026-08-24
> created: 2026-08-24

## Root Cause

`CuadraturaFacade.getActiveBranchId()` devuelve `this.branchFacade.selectedBranchId()` sin
modificar cuando el usuario es admin (vía `resolveBranchScope()`), y ese valor es `null` cuando
el admin tiene "Todas las sedes" seleccionado. Todas las queries del facade usan el patrón
`if (branchId) query.eq('branch_id', branchId)` — con `branchId === null` la condición es falsa
y **no se aplica ningún filtro de sede**:

- `fetchPayments`, `fetchExpensesAndAdvances`, `fetchSingularSales`,
  `fetchSpecialServiceSales`, `checkCajaStatus` devuelven datos de **todas las sedes
  mezclados** sin indicar de cuál es cada fila.
- `registrarEgreso()` y `cerrarCaja()` escriben `branch_id: this.getActiveBranchId()` → `null`.
  Ese registro queda huérfano: como en SQL `NULL` nunca iguala a nada (ni a otro `NULL`), un
  filtro posterior `.eq('branch_id', 5)` para una sede específica **nunca** lo encuentra — el
  egreso/cierre desaparece de cualquier vista por sede, solo es visible de nuevo en "Todas las
  sedes".
- Consecuencia extra en `checkCajaStatus`: un cierre de caja hecho en "Todas las sedes" no
  bloquea ninguna sede específica (no matchea el filtro), pero si luego alguien vuelve a "Todas
  las sedes" y CUALQUIER sede cerró caja ese día, `cajaYaCerrada` se marca `true` globalmente —
  bloqueando por error una sede que en realidad sigue con la caja abierta.

La caja física es por sede — no existe una "caja consolidada" en el negocio — así que la vista
nunca debería ser operable sin una sede concreta elegida. El proyecto ya tiene el patrón exacto
para esto (`BranchGateComponent` + `BranchFacade.setRequiresSpecificBranch()`), usado hoy solo
en el wizard de Nueva Matrícula (`secretaria-matricula.component.ts`).

## ACs Afectados

- Ninguno de una spec formal — corrige un hallazgo de UAT sobre
  `docs/UAT-PLAN.md` → "Cierre de caja del día" / "Cambiar de sede en Dashboard (admin)".

## Cambio

- **Archivo:** `src/app/features/admin/contabilidad-cuadratura/admin-contabilidad-cuadratura.component.ts`
  **Qué cambia:** si el usuario es admin, llama `branchFacade.setRequiresSpecificBranch(true)`
  al montar (y `false` al destruir); si `branchFacade.selectedBranchId() === null`, renderiza
  `<app-branch-gate>` en vez de `<app-cuadratura-content>` — mismo patrón que
  `secretaria-matricula.component.ts`. El `effect()` que llama `facade.initialize()` solo se
  dispara cuando hay una sede concreta.
- **Archivo:** `src/app/features/secretaria/contabilidad-cuadratura/secretaria-contabilidad-cuadratura.component.ts`
  **Qué cambia:** sin cambios de comportamiento — las secretarias ya están ancladas a
  `branchId` propio vía `resolveBranchScope()` (no-admin), nunca ven `null`. Se revisa solo para
  confirmar que no aplica el gate innecesariamente.

## Test de Regresión

- `src/app/features/admin/contabilidad-cuadratura/admin-contabilidad-cuadratura.component.spec.ts > muestra branch-gate cuando el admin no tiene sede seleccionada` ✓
- `src/app/features/admin/contabilidad-cuadratura/admin-contabilidad-cuadratura.component.spec.ts > no llama facade.initialize() mientras está en branch-gate` ✓
