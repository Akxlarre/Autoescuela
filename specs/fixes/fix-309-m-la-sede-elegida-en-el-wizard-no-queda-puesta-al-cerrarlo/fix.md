# Fix: La sede elegida en el wizard no queda puesta al cerrarlo
> id: fix-309-m-la-sede-elegida-en-el-wizard-no-queda-puesta-al-cerrarlo
> refs: ASG-i-024, fix-274-m
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
Cuando el admin abre "Nueva Matrícula" con "Todas las sedes", el wizard le pide elegir una en la
pantalla "Selecciona una sede" y `SecretariaMatriculaComponent.onBranchSelectedFromGate()` la
aplica con `BranchFacade.selectBranch()`, el mismo cambio permanente que hace el selector del
topbar. Al cerrar el wizard nadie la deshace: la lista (y el resto de la app) queda filtrada por una
sede que el admin solo eligió para esa matrícula. `fix-274-m` resolvió el mismo problema para la
re-matrícula desde Ex-Alumnos B y dejó este caso anotado como "no se decidió". Comprobado en
navegador en `fix-264-m` (`024a` O04).

**Decisión del owner (Matías, 2026-10-04):** al cerrar el wizard, el selector vuelve a la sede que
el admin tenía ("Todas las sedes").

## ACs Afectados
- AC-1: sede elegida en la pantalla de selección del wizard → al cerrarse el wizard (terminado,
  cancelado o con la X) el selector vuelve al valor anterior.
- AC-2: mientras el wizard está abierto, la sede activa es la elegida (sin cambios).
- AC-3: una sede elegida a mano en el topbar no se toca al cerrar el wizard.

## Cambio
- **Archivo:** `src/app/features/secretaria/matricula/secretaria-matricula.component.ts` — la sede
  de la pantalla de selección se aplica como cambio temporal (`selectBranchTemporarily()`, de
  `fix-274-m`) y se restaura al destruirse el wizard.

## Test de Regresión
- `secretaria-matricula.component.spec.ts > sede elegida en el wizard (fix-309-m)` (2 tests) ✓
- `e2e/alumnos-b-lista.spec.ts > O04` ✓ — al cerrar el wizard el selector vuelve a "Todas las
  sedes" y la lista vuelve a mostrar la columna Sede. Antes del arreglo quedaba en "Conductores
  Chillán" (medido en `fix-264-m`).

## Verificación
2026-10-04: los 12 tests del componente pasan, y en navegador O04 y W05 (la re-matrícula de
`fix-274-m`, que usa el mismo mecanismo y no cambió).
