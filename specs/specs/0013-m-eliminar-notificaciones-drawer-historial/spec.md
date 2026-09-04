# Spec 0013-m — Eliminar notificaciones (individual/todas) + drawer "Ver todas" con historial completo

> **Status:** draft
> **Created:** 2026-09-04
> **Owner:** Matías
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Asignación de equipo `ASG-i-005` (creada por Ignacio, reclamada por Matías el
2026-09-04).

**Persona afectada:** Cualquier usuario autenticado con notificaciones (Admin, Secretaria,
Instructor) — consumidores de `app-notifications-panel` desde el Topbar.

**Problema que resuelve:** El panel de notificaciones (`app-notifications-panel`, dropdown desde
el Topbar) hoy no tiene forma de eliminar una notificación individual ni de "eliminar todas" —
solo permite marcar como leídas (`markRead`/`markReadMany`/`markAllRead`). El panel tampoco tiene
límite de ítems: `NotificationsFacade` le pasa toda la lista y el `@for` la renderiza completa,
sin una vista dedicada para revisar el historial. Confirmado contra el código real: el DTO
`notification.model.ts` no tiene columna `deleted_at` ni equivalente — cualquier forma de
"eliminar" que preserve historial requiere migración de BD nueva.

**Hipótesis de valor:** Si el usuario puede descartar notificaciones que ya no le interesan (una
por una o todas) y el panel se acota a un tamaño manejable con acceso a un historial completo vía
drawer, el panel deja de saturarse con el tiempo y sigue siendo útil como vista rápida.

---

## 2. User Stories

- **US1**: Como usuario del panel de notificaciones, quiero poder eliminar una notificación
  puntual, para dejar de verla en mi panel sin tener que marcarla como leída si no aplica.
- **US2**: Como usuario del panel de notificaciones, quiero un botón para eliminar todas las
  notificaciones visibles, para limpiar el panel de una vez.
- **US3**: Como usuario del panel de notificaciones, quiero que el panel muestre como máximo 10
  notificaciones y un link "Ver todas" al final, para no perder de vista el resto de mi
  historial aunque el panel esté acotado.
- **US4**: Como usuario del panel de notificaciones, quiero poder abrir el historial completo
  (incluyendo lo eliminado) aunque el panel esté vacío, para poder revisar notificaciones
  pasadas incluso si ya no tengo nada pendiente.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: {{pendiente — completar con el usuario}}
- **AC2**: …
- **AC3**: …

### Edge cases obligatorios

- **AC-E1**: {{pendiente — ¿qué pasa al eliminar un ítem individual dentro de un grupo
  colapsado del panel (`NotificationPanelEntry` kind: 'group')?}}
- **AC-E2**: …

---

## 4. Out of scope

- ❌ {{a definir junto con el usuario}}

---

## 5. Dependencias

### Specs previas
- Ninguna formal.

### Capacidades del proyecto que se asumen existentes
- `NotificationsFacade` (`core/facades/notifications.facade.ts`).
- `app-notifications-panel` (dumb, `shared/components/notifications-panel/`).
- `LayoutDrawerFacadeService` para abrir el nuevo drawer.
- `.claude/rules/notifications.md` — arquitectura de 3 capas (Toast/Notificación/Alerta); esta
  spec es sobre la Capa 2 (Notificaciones persistentes).

### Capacidades nuevas requeridas
- Método(s) nuevo(s) en `NotificationsFacade` para eliminar una notificación y eliminar todas —
  probablemente soft-delete (columna `deleted_at` en `notifications`, confirmado que no existe
  hoy en el DTO), dado que el drawer de "Ver todas" debe listar también las eliminadas.
- Migración SQL: columna `deleted_at` (o equivalente) en tabla `notifications` existente + policy
  RLS si corresponde.
- Nuevo drawer con historial completo (existentes + eliminadas), abierto desde el link "Ver
  todas" del panel y desde el propio empty state.

---

## 6. Datos y modelo (preliminar)

- Tabla modificada: `notifications` (agregar `deleted_at` o equivalente — a confirmar
  mecanismo exacto en `/spec-plan`).
- Modelos UI: evaluar si `ui/notification.model.ts` necesita campo derivado (ej. `isDeleted`).
- RLS: evaluar si la policy existente de `notifications` ya cubre UPDATE del soft-delete o hace
  falta una nueva.

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): `app-notifications-panel` (dropdown del Topbar) + nuevo drawer de
  historial.
- Flujo principal: panel muestra máx. 10 ítems + botones de eliminar (individual y "eliminar
  todas") + link "Ver todas" → abre drawer con historial completo (existentes + eliminadas).
  El acceso al drawer también debe estar visible en el empty state del panel.
- Precedente de layout a revisar: `/app/instructor/notificaciones` (feed full-page con
  `NotificationsFacade`) — el pedido acá es un **drawer**, no una página; confirmar con el owner
  si conviene reutilizar ese patrón visual dentro del drawer.
- Estados especiales: pendiente de definir en `/spec-plan` (loading del drawer, confirmación
  antes de "eliminar todas", etc.).

---

## 8. Métricas de éxito post-launch

- {{opcional — a definir con el usuario}}

---

## 9. Notas / decisiones abiertas

- [ ] ¿"Eliminar" es soft-delete (recomendado, dado que el drawer debe listar las eliminadas) o
  hay otra forma de distinguir "eliminada" vs "no eliminada" ya existente en el modelo de datos?
  No asumir sin confirmar con el owner — la ASG original ya dejaba esto abierto.
- [ ] ¿Cómo interactúa "eliminar individual" con los grupos colapsados del panel
  (`NotificationPanelEntry` kind: 'group')? No estaba resuelto en la ASG original.
- [ ] ¿El drawer reutiliza el layout de `/app/instructor/notificaciones` o es un diseño nuevo?
- Originado de Asignación ASG-i-005 (specs/assignments/ASG-i-005-eliminar-notificaciones-drawer-historial.md)

---

## Changelog

- 2026-09-04 — draft inicial por Matías, a partir de `ASG-i-005` (creada por Ignacio,
  2026-08-31). Contexto/Objetivo y Alcance confirmados tal cual por el owner al reclamar, sin
  ajustes.
