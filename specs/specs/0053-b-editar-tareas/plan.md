# Plan — Spec 0053-b (editar una tarea enviada)

> **Status:** approved (el owner pidió implementarla, 2026-10-20)

## Cambios

1. **`core/utils/task.utils.ts`** (+ spec): `taskEditPayload(tipo, cambios)` arma el UPDATE
   (asunto recortado, descripción vacía → null, `due_date` con `dueDateToInstant` solo en tareas).
2. **`core/facades/tasks.facade.ts`** (+ spec): `updateTask(tarea, cambios)` — UPDATE con
   `.eq('status', 'pending')` y `assertWriteOk({ requireRows: true })`; 0 filas → AC-E1; notifica
   "Tarea modificada: <asunto>" al destinatario; `refreshSilently`; toast "Tarea actualizada".
3. **`core/services/ui/task-create-context.service.ts`**: `editing` (la tarea a editar) +
   `primeEdit(tarea)`; `reset()` la limpia.
4. **`features/tareas/task-create-drawer.component.ts`**: en modo edición precarga los campos,
   deshabilita tipo y destinatario (mostrando el actual), botón "Guardar cambios", y al guardar
   vuelve al detalle (`drawer.back()`).
5. **`features/tareas/task-detail-modal.component.ts`**: "Editar" habilitado para `canEdit`; abre el
   formulario apilado (`drawer.push`).

## Verificación

- vitest de `task.utils` y `tasks.facade`.
- e2e `comunicacion-tareas.spec.ts`: el admin edita una tarea pendiente (AC1–AC4), la secretaria
  destinataria no ve "Editar" (AC5).
