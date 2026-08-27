# Fix: Picker de destinatarios de "Nueva comunicación" (Tareas) no filtra instructores por sede

> id: fix-030-i-tasks-recipient-picker-no-branch-filter
> refs: docs/UAT-PLAN.md (Paquete 6, caso "Tareas internas: crear tarea/observación dirigida a un
>   usuario → destinatario la ve y puede responder/marcar estado")
> status: done
> closed: 2026-08-27
> created: 2026-08-27

## Root Cause

`TasksFacade.loadRecipients()` (`src/app/core/facades/tasks.facade.ts:341-364`) solo aplica
filtro de sede (`branch_id = X`) cuando `fromRole === 'admin'`. Para una secretaria, el
comentario en el código asumía que "la RLS policy de `users` ya scopea los resultados" — **esto
es falso, verificado empíricamente**: una secretaria de la sede 1 (Autoescuela Chillán) puede
`SELECT` sin restricción un usuario `id=169` con `branch_id=2` (Conductores Chillán). El picker
de destinatarios de "Nueva comunicación" listaba entonces instructores de **cualquier** sede.

Al enviar la tarea, la policy `tasks_insert` (correcta, de `20260522000002_fix_tasks_insert_rls_
secretary_to_admin.sql`) exige, para `to_role = 'instructor'`, que
`branch_id = (SELECT branch_id FROM users WHERE id = to_user_id)` — es decir, que el instructor
destinatario sea de la MISMA sede que la secretaria. El INSERT es rechazado con
`42501 new row violates row-level security policy for table "tasks"` (HTTP 403).

**Verificado en vivo (UAT, 2026-08-27):** `secretaria@test.com` (sede 1) intentó enviar una tarea
a "Instructor Prueba" (`users.id=169`, `branch_id=2`) — el picker lo mostró como opción válida,
pero el INSERT fue rechazado por RLS. `TasksFacade.createTask()` sí captura el error y muestra un
toast (`'Error al crear la tarea'`, genérico pero visible — a diferencia de fix-029-i, este catch
no es una falla silenciosa), pero el picker nunca debió ofrecer esa opción.

**Patrón repetido:** esta es la tercera vez en esta sesión de UAT que un Facade asume incorrectamente
un scope de sede sin verificarlo (ver DG-084 — `AgendaFacade` — y DG-085 — manejo de error de
Edge Functions, causa distinta pero mismo origen de "asunción sin verificar"). Se documenta como
nueva entrada DOMAIN-GOTCHAS.

## ACs Afectados

- Ninguno de una spec formal — fix autónomo descubierto en `docs/UAT-PLAN.md` Paquete 6.

## Cambio

- **Archivo:** `src/app/core/facades/tasks.facade.ts`
- **Qué cambia:** `loadRecipients()` post-filtra los candidatos con `taskRole === 'instructor'`
  cuando `fromRole === 'secretary'`: solo quedan los de la misma sede
  (`branch_id === currentUser.branchId`) o los que tengan `instructors.both_branches = true`
  (segunda query + `Set` de ids, mismo patrón que `InstructoresFacade`/`AgendaFacade` — DG-084).
  Los destinatarios `admin` no se tocan (siguen cross-branch, comportamiento correcto ya
  existente).

## Test de Regresión

- `src/app/core/facades/tasks.facade.spec.ts` — nuevo caso: `loadRecipients()` como secretaria
  excluye un instructor de otra sede sin `both_branches`, e incluye uno con `both_branches=true`.
