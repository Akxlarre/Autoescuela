# Hotfix: el admin no ve las tareas que le manda la secretaria de otra sede
> id: hotfix-101-b-tareas-recibidas-otra-sede
> refs: ASG-i-035 (checklist 035, S8 · C06)
> status: done
> created: 2026-10-20

## Problema
Una tarea secretaria → admin queda con la sede de la secretaria (`tasks.branch_id`). La lista del
admin filtraba `branch_id = <sede del selector>`: con la sede A elegida, lo que le mandaba la
secretaria de B no aparecía en "Dirigidas a mí" ni contaba en Pendientes, aunque sí le llegaba la
notificación. Verificado en e2e (tarea de `secretaria2@test.com`, `branch_id = 2`, admin en sede 1).

## Cambios
- **Archivo:** `src/app/core/utils/task.utils.ts` (+ spec): `taskBranchScopeFilter(sede, usuario)`
  — la sede elegida filtra las tareas ajenas, pero las que el usuario envió o recibió se ven siempre.
- **Archivo:** `src/app/core/facades/tasks.facade.ts` (+ spec): usa ese filtro (`.or(...)`) en vez de
  `.eq('branch_id', …)`.

## Verificación
- [x] vitest de `task.utils` y `tasks.facade` (91).
- [x] e2e `comunicacion-tareas.spec.ts` C06 (y B01 sigue en verde).
