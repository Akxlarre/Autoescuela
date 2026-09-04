# Spec 0013-m — Eliminar notificaciones (individual/todas) + drawer "Ver todas" con historial completo

> **Status:** approved
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

- **AC1**: Given una notificación individual visible en el panel, When el usuario hace clic en
  su botón de eliminar, Then la notificación se marca con `deleted_at` (soft-delete) y desaparece
  del panel de inmediato (sin recargar la página).
- **AC2**: Given el panel tiene al menos una notificación visible, When el usuario hace clic en
  "Eliminar todas", Then todas las notificaciones visibles en ese momento quedan marcadas con
  `deleted_at` y el panel pasa a mostrar el empty state.
- **AC3**: Given el panel tiene más de 10 notificaciones no eliminadas, When se renderiza, Then
  muestra como máximo 10 y, al final de la lista, un link/botón "Ver todas".
- **AC4**: Given el usuario hace clic en "Ver todas" (o en el trigger del empty state), When se
  abre el drawer de historial, Then el drawer lista tanto las notificaciones no eliminadas como
  las eliminadas (`deleted_at` no nulo), distinguibles visualmente entre sí.
- **AC5**: Given el panel no tiene ninguna notificación (empty state), When se renderiza el
  empty state, Then igual se muestra un trigger para abrir el drawer de historial completo.
- **AC6**: Given el drawer de historial completo, When se compara su estructura visual contra
  `/app/instructor/notificaciones` (feed full-page existente), Then reutiliza ese mismo patrón
  de layout adaptado al ancho de un drawer (no es un diseño visual nuevo desde cero).

### Edge cases obligatorios

- **AC-E1**: Given un grupo colapsado (`NotificationPanelEntry` kind: 'group', 3+ no leídas del
  mismo tipo/día) que el usuario expande, When el usuario hace clic en eliminar sobre uno de los
  ítems individuales dentro del grupo expandido, Then esa notificación puntual se soft-elimina
  igual que un ítem suelto, sin afectar al resto del grupo.
- **AC-E2**: Given una notificación ya soft-eliminada (`deleted_at` no nulo), When se evalúa si
  cuenta para `unreadCount()` o para el cap de 10 del panel, Then NO cuenta — el panel y el
  contador solo consideran notificaciones no eliminadas.
- **AC-E3**: Given el usuario hace clic en "Eliminar todas" con notificaciones agrupadas
  visibles (`kind: 'group'`), When se ejecuta la eliminación masiva, Then se soft-eliminan todas
  las notificaciones individuales que componen esos grupos, no solo las que estaban sueltas.

---

## 4. Out of scope

- ❌ Borrado físico (`DELETE`) de notificaciones — todo eliminado queda como soft-delete
  recuperable a nivel de datos (aunque no haya UI de "restaurar" en esta spec).
- ❌ UI para "restaurar" una notificación eliminada desde el drawer — el drawer solo lista el
  historial, no permite deshacer el borrado.
- ❌ Cambios a la lógica de agrupamiento existente (`NotificationPanelEntry` kind: 'group') más
  allá de que el botón eliminar funcione dentro de un grupo expandido.
- ❌ Purga automática/TTL de notificaciones soft-eliminadas (ej. borrado físico tras N días) —
  fuera de alcance, evaluar en una spec futura si la tabla crece demasiado.

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

- [x] "Eliminar" es soft-delete vía columna `deleted_at` en `notifications` (confirmado con el
  owner, 2026-09-04).
- [x] Eliminar individual SÍ funciona dentro de grupos colapsados expandidos, ítem por ítem
  (confirmado con el owner, 2026-09-04).
- [x] El drawer reutiliza el layout visual de `/app/instructor/notificaciones`, adaptado al
  ancho de un drawer (confirmado con el owner, 2026-09-04).
- Originado de Asignación ASG-i-005 (specs/assignments/ASG-i-005-eliminar-notificaciones-y-ver-todas-drawer.md)

---

## Changelog

- 2026-09-04 — draft inicial por Matías, a partir de `ASG-i-005` (creada por Ignacio,
  2026-08-31). Contexto/Objetivo y Alcance confirmados tal cual por el owner al reclamar, sin
  ajustes.
