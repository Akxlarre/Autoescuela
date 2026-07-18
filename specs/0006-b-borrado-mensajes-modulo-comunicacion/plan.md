# Plan 0006-b — Borrado de mensajes en módulo de comunicación

> **Spec:** [spec.md](./spec.md)
> **Status:** done
> **Created:** 2026-05-26

---

## 1. Resumen ejecutivo

Feature pequeño y contenido: agregar `canDelete` como flag de permisos en `TaskRow` (mismo patrón que `canEdit`/`canChangeStatus`), exponer un botón "Eliminar" en `task-detail-modal` con confirm modal, y agregar un filtro de 90 días para tareas completadas en el query de `TasksFacade`. No requiere migración SQL. Todos los cambios son adiciones a código existente.

---

## 2. Inventario de impacto

### Archivos a CREAR

Ninguno.

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/models/ui/task.model.ts` | Agregar `canDelete: boolean` a `TaskRow` | AC1–AC5: nuevo permiso de borrado |
| `src/app/core/utils/task.utils.ts` | Agregar `canDeleteTask()`. Actualizar firma y cuerpo de `mapTaskDtoToRow()` | Functional Core para `canDelete` |
| `src/app/core/utils/task.utils.spec.ts` | Tests para `canDeleteTask`. Actualizar llamadas a `mapTaskDtoToRow` | TDD obligatorio para utils |
| `src/app/core/facades/tasks.facade.ts` | Filtro 90 días en `fetchData()`. Pasar `currentRole` a `mapTaskDtoToRow()` | AC6–AC8: anti-acumulación |
| `src/app/features/tareas/task-detail-modal.component.ts` | Botón "Eliminar" + `onDeleteClicked()` + inyectar `ConfirmModalService` | AC1–AC5: UX de borrado |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `app-icon` (`shared/components/icon/icon.component.ts`) — ícono `trash-2` en el botón
- `ConfirmModalService` (`core/services/ui/confirm-modal.service.ts`) — confirm modal destructivo ya usado en Topbar y Cuadratura

### Facades/Services existentes que extendemos
- `TasksFacade.softDelete(id)` — ya implementado y testeado (36 tests). Solo se expone desde la UI.
- `TasksFacade.fetchData()` — agregar filtro PostgREST de 90 días para `completed`.

### Componentes/Facades que NO existen y debemos crear
Ninguno — todo encaja en la estructura existente.

---

## 4. Modelo de datos

**N/A** — `deleted_at` ya existe en la tabla `tasks`. No se requiere migración.

El filtro de 90 días es puramente en el query client-side de `fetchData()`:

```sql
-- Pseudo-criterio del filtro aplicado vía PostgREST
WHERE deleted_at IS NULL
  AND (status != 'completed' OR created_at >= now() - interval '90 days')
```

En Supabase JS:
```typescript
const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
query = query.or(`status.neq.completed,created_at.gte.${ninetyDaysAgo}`);
```

### Modelos UI/DTO

- `core/models/ui/task.model.ts` — solo se agrega `canDelete: boolean` a la interfaz `TaskRow` existente.

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
task-detail-modal (Smart)
  ├─ inject(TasksFacade)        → task().canDelete  ← computed en Facade
  ├─ inject(ConfirmModalService) → confirm modal destructivo
  │
  ├─ @if (task()!.canDelete)
  │   └─ <button trash-2> → onDeleteClicked()
  │       ├─ confirmModal.confirm({ severity: 'danger' })
  │       │   ├─ cancelar → nothing
  │       │   └─ confirmar → tasksFacade.softDelete(id)
  │       │       ├─ UPDATE tasks SET deleted_at = now() WHERE id = ?
  │       │       └─ refreshSilently() → _tasks signal actualizado
  │       └─ tasksFacade.selectTask(null)  ← drawer muestra empty state
  │
  └─ fetchData() [TasksFacade]
      └─ query tasks WHERE deleted_at IS NULL
         AND (status != 'completed' OR created_at >= now()-90d)
```

### Capas tocadas

- **Smart**: `features/tareas/task-detail-modal.component.ts`
- **Dumb**: ninguno nuevo
- **Facade**: `core/facades/tasks.facade.ts` — `fetchData()` + pasar `currentRole` a mapper
- **Utils (Functional Core)**: `core/utils/task.utils.ts` — `canDeleteTask()` + `mapTaskDtoToRow()`
- **Model**: `core/models/ui/task.model.ts` — `TaskRow.canDelete`
- **Migration**: ninguna

### Lógica de permisos `canDeleteTask()`

```typescript
export function canDeleteTask(task: Task, currentUserId: number, currentRole: string): boolean {
  // Admin puede borrar cualquier tarea en cualquier estado
  if (currentRole === 'admin') return true;
  // Emisor solo si la tarea aún no tuvo interacción (status='pending')
  return task.from_user_id === currentUserId && task.status === 'pending';
}
```

**Por qué `status='pending'` cubre los 3 tipos:**
- `task` en `pending` → nadie la inició
- `observation` en `pending` → no fue vista (`seen_at` es null; `markSeen()` → `completed`)
- `question` en `pending` → sin respuestas (`addReply()` → `in_progress`)

---

## 6. Restricciones aplicables

- [x] `architecture.md` — OnPush, signals, patrón Facade. El modal ya es Smart/OnPush.
- [ ] `facades.md` — No se crea Facade nuevo.
- [x] `models.md` — Se extiende `TaskRow` (UI model). No se crea DTO nuevo.
- [x] `visual-system.md` — Botón con `var(--state-error)` (ghost destructivo, no hardcoded).
- [x] `swr-pattern.md` — `softDelete()` ya llama `refreshSilently()` post-mutación.
- [x] `notifications.md` — No se agrega toast nuevo; `softDelete()` ya tiene `toast.error` en catch.
- [x] `testing-tdd.md` — `canDeleteTask()` es función pura → tests obligatorios en `task.utils.spec.ts`.
- [x] `ai-readability.md` — Botón eliminar lleva `data-llm-action="delete-task"`.

---

## 7. Plan de testing

**Unitarios en `task.utils.spec.ts` (TDD):**
- `canDeleteTask` — admin borra siempre (3 estados × 1 caso)
- `canDeleteTask` — emisor secretaria borra solo en `pending`
- `canDeleteTask` — emisor secretaria NO borra en `in_progress`
- `canDeleteTask` — emisor secretaria NO borra en `completed`
- `canDeleteTask` — destinatario (no emisor) NUNCA borra
- `canDeleteTask` — instructor NUNCA borra (aunque fuera emisor — no puede serlo por modelo)
- `mapTaskDtoToRow` — actualizar las 4 llamadas existentes con `currentRole` + test `canDelete`

**QA manual (golden path):**
1. Secretaria crea tarea → abre detalle → ve botón "Eliminar" → confirma → desaparece
2. Secretaria abre tarea `in_progress` → NO ve botón eliminar
3. Admin abre tarea de otro usuario en cualquier estado → ve botón eliminar
4. Destinatario instructor abre tarea recibida → NO ve botón eliminar
5. Lista no muestra tareas `completed` > 90 días

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| `mapTaskDtoToRow()` tiene 4 llamadas en el spec file — rompe al cambiar firma | Alta | Actualizar todos los calls en el mismo commit. Tests validan todo. |
| Filtro `.or()` en PostgREST con campos `timestamptz` + timezone | Media | Usar `toISOString()` directamente (UTC). El campo `created_at` es `timestamptz` — OK. |
| Admin borra tarea `in_progress` que el destinatario está trabajando | Baja | Intencional por diseño. El confirm modal es suficiente guardia. No se agrega notificación al destinatario (Out of scope). |
| `currentRole` del usuario es `'secretaria'` en runtime pero el DTO guarda `'secretary'` | Bajo | `canDeleteTask()` recibe `currentUser().role` (UI role = 'secretaria') — la lógica usa solo comparación con 'admin', el resto es `from_user_id`. No hay confusión. |

---

## 9. Orden de implementación

1. **`task.utils.ts`** — agregar `canDeleteTask()` + actualizar firma de `mapTaskDtoToRow()`
2. **`task.utils.spec.ts`** — escribir tests para `canDeleteTask` + actualizar calls a `mapTaskDtoToRow` → `npm run test:ci` pasa
3. **`task.model.ts` (UI)** — agregar `canDelete: boolean` a `TaskRow`
4. **`tasks.facade.ts`** — pasar `currentRole` a `mapTaskDtoToRow()` + filtro 90 días en `fetchData()`
5. **`task-detail-modal.component.ts`** — botón + handler + inyectar `ConfirmModalService`
6. **`npm run test:ci`** — validar que los 36 tests existentes + nuevos pasen
7. **`npm run lint:arch`** — validar arquitectura

---

## 10. Estimación

S — menos de 2 horas. Todos los cambios son aditivos en archivos ya conocidos.

---

## Changelog

- 2026-05-26 — plan inicial generado desde spec aprobada
