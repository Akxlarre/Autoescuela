# Fix: observationTasks del admin incluye observaciones de terceros
> id: fix-003-b-observationtasks-admin-incluye-terceros
> refs: 0001-sistema-de-tareas-multi-rol
> status: done
> closed: 2026-05-21
> created: 2026-05-21

## Root Cause
`TasksFacade.observationTasks` filtra por `type === 'observation'` sobre `_tasks`, que para
el admin contiene TODAS las tareas del branch (RLS lo permite). Resultado: el tab
"Observaciones" del admin muestra observaciones entre secretaria e instructor donde
el admin no es ni emisor ni receptor — ruido puro sin valor para él.

## ACs Afectados
- Ninguno — fix autónomo (la spec no definió el alcance de `observationTasks`)

## Cambios
- **`src/app/core/facades/tasks.facade.ts`**
  → `observationTasks`: agregar filtro por `from_user_id` o `to_user_id` igual al usuario actual,
  igual al patrón ya usado en `myTasks`.

## Test de Regresión
- `src/app/core/facades/tasks.facade.spec.ts > TasksFacade > computed signals > observationTasks returns only type=observation tasks`
  → extender para verificar que solo devuelve obs donde el usuario actual es participante
