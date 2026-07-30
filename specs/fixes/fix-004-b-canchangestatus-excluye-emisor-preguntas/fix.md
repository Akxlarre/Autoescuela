# Fix: canChangeStatus excluye al emisor de preguntas
> id: fix-004-b-canchangestatus-excluye-emisor-preguntas
> refs: 0001-sistema-de-tareas-multi-rol
> status: done
> closed: 2026-05-21
> created: 2026-05-21

## Root Cause
`canChangeStatus` en `task.utils.ts` solo permite cambiar el estado al destinatario
(`to_user_id === currentUserId`). Para `type='question'`, el emisor es quien hizo la
pregunta — es él quien sabe si la respuesta recibida fue suficiente y debería poder
cerrarla. Sin esto, una pregunta queda en `in_progress` indefinidamente a menos que
el receptor (quien respondió) la cierre, lo cual es semánticamente incorrecto.

## ACs Afectados
- Ninguno — edge case no cubierto en la spec original

## Cambios
- **`src/app/core/utils/task.utils.ts`**
  → `canChangeStatus`: para `type='question'` también devuelve `true` cuando el
  usuario actual es el emisor (`from_user_id === currentUserId`) y el estado no es `completed`

## Test de Regresión
- `src/app/core/utils/task.utils.spec.ts > canChangeStatus > returns true for question sender when status is not completed`
