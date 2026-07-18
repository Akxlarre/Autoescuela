# Spec 0006-b — Borrado de mensajes en módulo de comunicación

> **Status:** approved
> **Created:** 2026-05-26
> **Owner:** Akxlarre
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Conversación directa — necesidad de mantener el módulo limpio sin acumulación excesiva.

**Persona afectada:** Admin, Secretaria (emisores de tareas/observaciones/consultas).

**Problema que resuelve:**
El módulo de comunicación interna (tareas, observaciones, consultas) no tiene mecanismo de limpieza. Con el tiempo, las tareas completadas se acumulan en la lista sin forma de eliminarlas. Los mensajes enviados por error tampoco pueden borrarse. Esto convierte el módulo en un "basurero" con historial irrelevante.

**Hipótesis de valor:**
Si el emisor puede eliminar sus mensajes pendientes y la lista filtra automáticamente los completados > 90 días, el módulo mantiene un volumen manejable y el equipo lo usa con más confianza.

---

## 2. User Stories

- **US1**: Como admin o secretaria (emisor), quiero poder eliminar un mensaje que envié y aún no fue procesado, para corregir envíos erróneos.
- **US2**: Como admin, quiero poder eliminar cualquier mensaje (de cualquier usuario) en casos excepcionales, para mantener el orden.
- **US3**: Como usuario del sistema, quiero que la lista de comunicaciones no acumule mensajes completados muy antiguos, para no perderme en el historial.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given soy el emisor de un mensaje con `status='pending'`, When abro el detalle, Then veo el botón "Eliminar".
- **AC2**: Given soy el emisor de un mensaje con `status='in_progress'` o `'completed'`, When abro el detalle, Then NO veo el botón "Eliminar".
- **AC3**: Given soy admin, When abro el detalle de cualquier mensaje (propio o de terceros), Then veo el botón "Eliminar" sin importar el estado.
- **AC4**: Given veo el botón "Eliminar" y hago click, When aparece el confirm modal, Then puedo cancelar (sin borrar) o confirmar (el mensaje desaparece de la lista).
- **AC5**: Given soy el destinatario de un mensaje pero NO el emisor, When abro el detalle, Then NO veo el botón "Eliminar".
- **AC6**: Given hay tareas/observaciones/consultas con `status='completed'` creadas hace más de 90 días, When cargo el módulo, Then esos mensajes NO aparecen en la lista.
- **AC7**: Given hay tareas/observaciones/consultas con `status='completed'` creadas hace menos de 90 días, When cargo el módulo, Then esos mensajes SÍ aparecen.
- **AC8**: Given hay tareas `pending` o `in_progress` sin importar su antigüedad, When cargo el módulo, Then siempre aparecen.

### Edge cases obligatorios

- **AC-E1**: Given soy instructor (receptor puro, sin capacidad de envío), Then NUNCA veo el botón "Eliminar".
- **AC-E2**: Given el borrado es soft-delete (`deleted_at`), Then el registro persiste en BD pero no aparece en la UI.
- **AC-E3**: Given una observación ya fue vista (`seen_at` != null → status='completed'), When soy el emisor, Then NO puedo eliminarla (ya hay interacción registrada).

---

## 4. Out of scope

- ❌ Vista de "Papelera" con mensajes borrados recuperables.
- ❌ Borrado permanente (hard-delete) desde la UI.
- ❌ Capacidad de borrar respuestas (`task_replies`) individualmente.
- ❌ Notificación al destinatario cuando su mensaje es eliminado.
- ❌ Borrado en lote (selección múltiple).

---

## 5. Dependencias

### Specs previas
- `0001-sistema-de-tareas-multi-rol` — debe estar `done` (define la tabla `tasks`, el modelo, el `TasksFacade` y `softDelete()`).

### Capacidades del proyecto que se asumen existentes
- `TasksFacade.softDelete(id)` — ya implementado en `core/facades/tasks.facade.ts`
- Campo `deleted_at` en tabla `tasks` — ya existe en modelo y BD
- `ConfirmModalService` — ya existe en `core/services/ui/confirm-modal.service.ts`
- `TaskRow.canEdit` / `canChangeStatus` — patrón de flags de permisos ya establecido

### Capacidades nuevas requeridas
- `canDeleteTask()` función pura en `core/utils/task.utils.ts`
- `canDelete: boolean` en `TaskRow` (ui model)
- Filtro de 90 días en `fetchData()` de `TasksFacade`
- Botón "Eliminar" en `task-detail-modal.component.ts`

---

## 6. Datos y modelo (preliminar)

- Tablas modificadas: ninguna — `deleted_at` ya existe en `tasks`.
- Modelos UI: agregar `canDelete: boolean` a `TaskRow` (`core/models/ui/task.model.ts`).
- RLS: no requiere cambios — `softDelete` ya usa la clave anónima con RLS existente.
- Query: agregar filtro en `fetchData()`:  
  `(status != 'completed') OR (created_at >= now() - 90 days)`

---

## 7. UX y flujos (preliminar)

- Pantalla afectada: `task-detail-modal.component.ts` (drawer de detalle de tarea).
- Flujo principal: usuario abre tarea → ve botón "Eliminar" (si aplica) → confirm modal → tarea desaparece de la lista → drawer muestra estado vacío.
- El botón "Eliminar" se ubica junto al botón "Editar" (zona de acciones del modal).
- Color: `var(--state-error)` / borde y texto en rojo — estilo ghost destructivo.
- Confirm modal: severity `danger`, texto descriptivo según tipo de mensaje.

---

## 8. Métricas de éxito post-launch

- La lista de tareas en la vista principal no supera 50 ítems en el 95% de los casos de uso habituales de la escuela.
- Los errores de envío (tareas enviadas por error) se pueden corregir sin contactar al admin.

---

## 9. Notas / decisiones abiertas

- [x] ¿Admin puede borrar tareas de terceros siempre? → **Sí, siempre. Con confirm modal.**
- [x] ¿Período de retención para completadas? → **90 días.**
- [x] ¿Papelera en UI? → **No. Soft-delete sin vista de recuperación.**
- [x] ¿Destinatario puede borrar? → **Nunca.**

---

## Changelog

- 2026-05-26 — draft inicial + approved por Akxlarre (criterios acordados en conversación)
