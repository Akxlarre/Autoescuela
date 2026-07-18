# Fix: Flujo de estados de tareas según tipo
> id: fix-001-b-flujo-estados-tareas
> refs: 0001-sistema-de-tareas-multi-rol
> status: done
> closed: 2026-05-21
> created: 2026-05-21

## Root Cause
El flujo de estados fue implementado de forma uniforme para todos los tipos de tarea,
ignorando que cada tipo tiene una semántica de resolución distinta:
- `observation`: se resuelve al ser leída (auto), pero `markSeen` setea `seen` en vez de `completed`
- `task`: requiere acción manual pero obliga a dos pasos (pending → in_progress → completed)
- `question`: no auto-avanza a `in_progress` al recibir la primera respuesta

Resultado: observaciones que nunca se "resuelven", tareas con fricción innecesaria,
y preguntas que quedan en `pending` aunque ya tienen respuestas.

## ACs Afectados
- AC2: `updateStatus` debe soportar transición directa `pending → completed` para tasks
- AC3: `completed_at` debe setearse en todos los caminos que llevan a `completed`
- AC5: `markSeen` en observations debe dejar `status='completed'`, no `status='seen'`
- AC8: primera reply en `question` debe auto-transicionar a `in_progress`

## Cambios
- **`src/app/core/facades/tasks.facade.ts`** → `markSeen()` setea `status: 'completed'` + `completed_at`; `addReply()` auto-transiciona question de `pending` a `in_progress`
- **`src/app/core/models/dto/task.model.ts`** → eliminar `'seen'` de `TaskStatus`
- **`src/app/features/tareas/task-detail-modal.component.ts`** → agregar botón "Completar" directo cuando `status === 'pending'` para tasks y questions

## Test de Regresión
- `src/app/core/facades/tasks.facade.spec.ts > TasksFacade > markSeen() > AC5: calls UPDATE with seen_at and seen_by=currentUser.dbId` → actualizar para verificar status=completed
- `src/app/core/facades/tasks.facade.spec.ts > TasksFacade > addReply() > AC8: inserts into task_replies and returns true` → agregar caso que verifica auto in_progress
