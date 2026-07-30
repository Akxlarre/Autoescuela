# Fix: Selector de sede del topbar no avanza el branch-gate del wizard de matrícula
> id: fix-067-m-branch-gate-topbar-reactivo
> refs: —
> status: done
> closed: 2026-07-25
> created: 2026-07-25

## Root Cause
`SecretariaMatriculaComponent` muestra `'branch-gate'` (pantalla "Selecciona una sede") cuando
un admin con "Todas las sedes" entra a Nueva matrícula. Elegir una sede desde las tarjetas del
centro funciona porque `onBranchSelectedFromGate()` llama explícitamente a
`branchFacade.selectBranch(id)` **y** vuelve a invocar `initWizard()` a mano.

El `effect()` del constructor (L131-142) que reacciona a `branchFacade.selectedBranchId()`
solo actúa si `untracked(() => this._viewMode())` es `'wizard'` (L138: `if (... !== 'wizard') return;`).
Cuando la vista está en `'branch-gate'`, ese guard corta la ejecución y el effect no hace nada:
no hay ningún camino reactivo desde el selector de sede del topbar hacia `initWizard()`. El
`BranchFacade.selectBranch()` sí actualiza el signal compartido correctamente — el problema es
que `SecretariaMatriculaComponent` nunca vuelve a evaluar la gate al notar el cambio.

## ACs Afectados
Ninguno — fix autónomo (bug de reactividad, no ligado a una spec previa).

- AC-1: Estando en la pantalla "Selecciona una sede" del wizard de matrícula, si el admin
  cambia la sede desde el selector del topbar (en vez de las tarjetas centrales), el wizard
  debe avanzar automáticamente a la vista siguiente (draft-list o wizard limpio) para esa sede,
  igual que si hubiera hecho clic en la tarjeta correspondiente.
- AC-2: El comportamiento existente (reactividad del topbar mientras el wizard YA está activo,
  recargando cursos) no sufre regresión.

## Cambio
- **Archivo:** `src/app/features/secretaria/matricula/secretaria-matricula.component.ts`
- **Qué cambia:** en el `effect()` del constructor (L131-142), cuando `_viewMode()` sea
  `'branch-gate'` (en vez de solo `'wizard'`), invocar `initWizard()` para que la gate se
  reevalúe con el nuevo `selectedBranchId()` — igual que hace `onBranchSelectedFromGate()`.

## Test de Regresión
- `src/app/features/secretaria/matricula/secretaria-matricula.component.spec.ts > avanza fuera de branch-gate cuando el topbar cambia la sede seleccionada` ✓
