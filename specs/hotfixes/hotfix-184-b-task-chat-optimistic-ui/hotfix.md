# Hotfix: actualización optimista (0ms) en envío de respuestas de tareas
> id: hotfix-184-b-task-chat-optimistic-ui
> refs: —
> status: done
> created: 2026-11-09
> closed: 2026-11-09

## Problema
Al enviar un mensaje en el hilo de chat de una tarea, la UI sufría un retraso de 600ms a 1.2s porque esperaba 3 peticiones secuenciales por la red a Supabase (insert → refresh tasks → fetch replies) antes de pintar la burbuja.

## Cambios
1. `src/app/core/facades/tasks.facade.ts`:
   - Implementar Optimistic UI en `addReply`: insertar inmediatamente (0ms) la respuesta en `_selectedTaskReplies` con un ID temporal.
   - Realizar la inserción en BD en segundo plano con `.select().single()`.
   - Reconciliar el ID temporal con el registro definitivo de BD al completarse la petición.
   - En caso de error de red, realizar rollback automático retirando el elemento optimista y alertando con toast.
2. `src/app/features/tareas/task-detail-modal.component.ts`:
   - Desacoplar `onReplySent` de esperas sincrónicas para no bloquear la UI.
