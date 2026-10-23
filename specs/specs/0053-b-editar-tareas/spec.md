# Spec 0053-b — Editar una tarea enviada

> **Status:** done
> **Closed:** 2026-10-20 (ver acceptance.md)
> **Created:** 2026-10-20
> **Owner:** Benjamín
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** `ASG-i-035` (checklist 035, S22 / D16). En el detalle de una tarea siempre aparecía un
botón "Editar" deshabilitado: la edición nunca se implementó (spec 0001-b AC-E2 la dejó solo en la
UI). Decisión del owner (2026-10-20): implementarla.

## 2. User Stories

- Como **emisor** de una tarea, observación o consulta, quiero corregir el asunto, la descripción o la
  fecha límite mientras siga pendiente, para no tener que eliminarla y crearla de nuevo.
- Como **destinatario**, quiero enterarme de que la tarea cambió.

## 3. Acceptance Criteria

- **AC1:** en el detalle, el emisor de una tarea pendiente ve "Editar" habilitado; al tocarlo se abre
  el formulario con el asunto, la descripción y (en tareas) la fecha límite ya cargados.
- **AC2:** el tipo y el destinatario se muestran pero no se pueden cambiar.
- **AC3:** "Guardar cambios" actualiza la tarea, avisa "Tarea actualizada" y vuelve al detalle con los
  datos nuevos. La fecha límite se guarda como el resto (23:59 de Chile, hotfix-100-b).
- **AC4:** el destinatario recibe la notificación "Tarea modificada: <asunto>" y ve el cambio sin
  recargar (Realtime ya existente).
- **AC5:** quien no es el emisor, o una tarea que ya no está pendiente, no muestra "Editar".
- **AC-E1:** si al guardar la tarea ya no está pendiente (la iniciaron mientras se editaba), no se
  guarda y avisa "La tarea ya no está pendiente; no se puede editar."
- **AC-E2:** asunto vacío o de solo espacios no deja guardar.

## 4. Fuera de alcance

- Cambiar el tipo o el destinatario (eso es otra tarea).
- Restringir en la BD qué columnas puede actualizar el destinatario (O03 del checklist 035).
- Historial de versiones de una tarea.

## 5. Notas / decisiones

- Sin migración: `tasks_update` ya deja actualizar al emisor.
- Se reutiliza `TaskCreateDrawerComponent` en modo edición vía `TaskCreateContextService`.
