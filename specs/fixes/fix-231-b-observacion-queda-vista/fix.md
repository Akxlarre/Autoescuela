# Fix: abrir una observación la deja "Vista", no "Completada"
> id: fix-231-b-observacion-queda-vista
> refs: ASG-i-035 (checklist 035, S11 · D04) · spec 0001-b AC5
> status: done
> created: 2026-10-20

## Root Cause
`TasksFacade.markSeen()` (al abrir la observación el destinatario) hacía
`status = 'completed'` + `completed_at`. Eso disparaba `trg_notify_task_completed` y quien la había
mandado recibía "Tarea completada", y el hilo quedaba cerrado. La spec 0001-b AC5 pedía `seen`, y
la BD ya acepta ese estado (`tasks_status_check`), pero el frontend no lo conocía: `TaskStatus` era
`pending | in_progress | completed` y el badge no tenía cómo mostrarlo. Verificado en e2e (D04:
estado `completed` tras abrirla).

Decisión del owner (2026-10-20): queda "Vista" y a quien la mandó le llega "<nombre> vio tu
observación".

## ACs Afectados
- 0001-b AC5: abrir una observación la marca como vista.

## Cambio
- `core/models/dto/task.model.ts`: `TaskStatus` incluye `seen`.
- `core/utils/task.utils.ts` (+ spec): `isTaskOpen(status)` (pendiente o en curso) para los
  contadores; `canChangeStatus` no ofrece acciones sobre una vista.
- `core/facades/tasks.facade.ts` (+ spec): `markSeen(tarea)` → `status = 'seen'` (sin
  `completed_at`) + notificación "Observación vista" a quien la mandó. Sin migración: el trigger
  solo avisa al pasar a `completed`.
- `features/tareas/task-detail-modal.component.ts`: pasa la tarea a `markSeen`.
- `shared/components/task-status-badge`: estado "Vista" (ícono `eye`, color info).
- `features/admin/tareas`, `features/secretaria/observaciones`, `features/instructor/tareas`:
  contadores con `isTaskOpen` (una observación vista ya no cuenta como pendiente).

## Test de Regresión
- vitest `task.utils` y `tasks.facade` (markSeen deja `seen` y notifica a quien la mandó).
- e2e `comunicacion-tareas.spec.ts` D04: tras abrirla queda `seen`, la secretaria recibe "Observación vista".

## Verificación
- vitest `task.utils` + `tasks.facade` 95/95; `test:ci` completo en verde; `lint:arch` sin errores.
- e2e D04: tras abrirla queda `seen`, la tarjeta dice "Vista" y la secretaria recibe solo "Observación vista".
