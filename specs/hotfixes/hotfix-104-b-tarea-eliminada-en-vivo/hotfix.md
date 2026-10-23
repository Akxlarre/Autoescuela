# Hotfix: una tarea eliminada sigue en la pantalla de la otra persona
> id: hotfix-104-b-tarea-eliminada-en-vivo
> refs: ASG-i-035 (checklist 035, S14 · E04)
> status: done
> created: 2026-10-20

## Problema
Eliminar una tarea es un soft delete (`soft_delete_task` pone `deleted_at`). La RLS de `tasks`
exige `deleted_at IS NULL` para leer, así que Realtime no le entrega el UPDATE a la otra persona
(no puede leer la fila nueva): la tarea quedaba en su lista hasta recargar. Verificado en e2e
(E04: el admin elimina, la tarjeta sigue del lado de la secretaria).

## Cambios
- **Archivo:** `src/app/core/facades/tasks.facade.ts` (+ spec):
  - tras eliminar, avisa por broadcast (`httpSend`, REST, sin unirse al canal) a los canales
    `tasks-received-<destinatario>` y `tasks-sent-<emisor>`, salvo a quien eliminó;
  - los dos canales escuchan ese evento (`task-deleted`) y refrescan.
  Sin migración ni cambio de RLS.

## Verificación
- [x] vitest de `tasks.facade` (47); `lint:arch` sin errores.
- [x] e2e E04 (`comunicacion-tareas.spec.ts`): desaparece del lado de la secretaria sin recargar.
