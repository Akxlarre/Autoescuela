# Tasks 0013-m — Eliminar notificaciones (individual/todas) + drawer "Ver todas" con historial completo

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-09-04

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Datos y modelo

- [ ] **T1.1** — Crear migración `20260904120000_notifications_soft_delete.sql`
  - **AC ref:** AC1, AC2, AC4
  - **DoD:**
    - [ ] `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL DEFAULT NULL`
    - [ ] Índice parcial `idx_notifications_not_deleted (recipient_id, created_at DESC) WHERE deleted_at IS NULL`
    - [ ] Confirmado que NO hace falta tocar `update_notifications`/`select_notifications` (ya
      cubren `recipient_id = auth_user_id()` sin distinguir `deleted_at`) — no agregar policy nueva
    - [ ] Aplicada manualmente contra Supabase (mismo flujo que el resto del proyecto — ver
      precedente `0012-m`), verificada primero contra Supabase local si hay Docker disponible
    - [ ] Documentado en `indices/DATABASE.md` (columna nueva + índice en la tabla `notifications`)

- [ ] **T1.2** — Extender DTO `core/models/dto/notification.model.ts`
  - **DoD:**
    - [ ] Agregar `deleted_at?: string | null;`
    - [ ] Sigue mapeando 1:1 con la tabla (sin campos derivados acá)
    - [ ] Documentado en `indices/MODELS.md`

- [ ] **T1.3** — Extender UI Model `core/models/ui/notification.model.ts`
  - **DoD:**
    - [ ] Agregar `deletedAt?: Date | null;` a `Notification`
    - [ ] No se crea un modelo nuevo — se extiende el existente (ya lo consumen panel, badge,
      página de instructor y el drawer nuevo)

- [ ] **T1.4** — Actualizar `core/utils/notification.utils.ts`
  - **AC ref:** AC4
  - **DoD:**
    - [ ] `mapNotificationDtoToUi()` mapea `deleted_at` → `deletedAt` (`null`/`undefined` → no
      eliminada)
    - [ ] `groupNotifications()` sin cambios de firma (sigue operando sobre listas ya filtradas
      por el Facade — el filtro de eliminadas vive en la query, no acá)

---

## Fase 2 — Capa Facade

- [ ] **T2.1** — Escribir tests nuevos en `notifications.facade.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC1, AC2, AC3, AC-E1, AC-E2, AC-E3
  - **DoD:**
    - [ ] Test: `loadNotifications()` excluye filas con `deleted_at` no nulo (mock del query
      builder confirma el filtro agregado)
    - [ ] Test: `deleteNotification(id)` hace optimistic-remove de `notifications()` y llama
      UPDATE con `deleted_at`; rollback si el UPDATE falla
    - [ ] Test: `deleteAllNotifications()` soft-elimina solo las no eliminadas del usuario
      actual; rollback en error
    - [ ] Test: `loadHistorial()` incluye ítems con `deleted_at` no nulo (a diferencia de
      `loadNotifications()`)
    - [ ] Test: `panelEntries` corta en 10, no en 15 (regresión directa de AC3)
    - [ ] Tests FALLAN en este punto (no hay implementación aún)

- [ ] **T2.2** — Implementar `deleteNotification(id)` y `deleteAllNotifications()` en
  `notifications.facade.ts`
  - **AC ref:** AC1, AC2, AC-E1, AC-E3
  - **DoD:**
    - [ ] Mismo patrón optimistic-update + rollback que `markAsRead()`/`markAllAsRead()`
    - [ ] `deleteAllNotifications()` hace `UPDATE ... WHERE recipient_id = dbId AND deleted_at IS
      NULL` (no una lista de IDs) — cubre automáticamente los ítems agrupados (AC-E3)
    - [ ] `data-llm-action` correspondiente ya previsto para el botón que los dispare (ver Fase 3)
    - [ ] Tests de T2.1 para estos dos métodos PASAN

- [ ] **T2.3** — Implementar `loadHistorial()` + estado `_historial`/`historial`/`isHistorialLoading`
  - **AC ref:** AC4
  - **DoD:**
    - [ ] Query sin filtro de `deleted_at` (a diferencia de `loadNotifications()`)
    - [ ] Estado expuesto readonly (`historial`, `isHistorialLoading`)
    - [ ] Se dispara on-demand (no en `initialize()`) — el drawer lo llama en su propio
      `ngOnInit()`
    - [ ] Tests de T2.1 para este método PASAN

- [ ] **T2.4** — Ajustar `loadNotifications()` y `panelEntries` en `notifications.facade.ts`
  - **AC ref:** AC3, AC-E2
  - **DoD:**
    - [ ] `loadNotifications()` agrega `.is('deleted_at', null)` al query
    - [ ] `panelEntries` cambia `.slice(0, 15)` → `.slice(0, 10)`
    - [ ] `unreadCount()` sigue correcto (ya no cuenta eliminadas, porque nunca llegan a
      `_notifications`)
    - [ ] Tests de T2.1 para ambos cambios PASAN
    - [ ] `npm run test:ci` verde para todo `notifications.facade.spec.ts`
    - [ ] Documentado en `indices/FACADES.md` (métodos y estado nuevos de `NotificationsFacade`)

---

## Fase 3 — Capa UI

- [x] **T3.1** — Extender `notifications-panel.component.ts` (Dumb) — botones de eliminar
  - **AC ref:** AC1, AC-E1
  - **DoD:**
    - [x] Nuevo `output()`: `deleteNotification = output<string>();`
    - [x] Botón eliminar en ítem `single` (icon button, `data-llm-action="delete-notification"`)
    - [x] Botón eliminar también en ítems anidados dentro de un grupo expandido (AC-E1) — mismo
      output, mismo id individual
    - [x] Sigue siendo Dumb: solo `input()`/`output()`, sin Facades inyectadas
    - [x] Tokens de color (sin Tailwind hardcodeado) para el ícono/botón de eliminar

- [x] **T3.2** — Extender `notifications-panel.component.ts` — "Eliminar todas" + "Ver todas"
  - **AC ref:** AC2, AC3, AC5
  - **DoD:**
    - [x] Nuevo `output()`: `deleteAllNotifications = output<void>();` y
      `openHistorial = output<void>();`
    - [x] Botón "Eliminar todas" visible cuando `entries().length > 0` (junto a "Marcar todo
      como leído" en el header, mismo patrón condicional)
    - [x] Trigger "Ver todas" (`data-llm-action="open-notifications-history"`) SIEMPRE visible —
      tanto al final de la lista con ítems como dentro del bloque `@empty` (AC5)
    - [x] `panelEntries` ya viene cortado a 10 desde el Facade (T2.4) — el componente no
      re-implementa el cap

- [x] **T3.3** — Estilos nuevos en `notifications-panel.component.scss`
  - **DoD:**
    - [x] Estilos para el botón eliminar por ítem (hover/focus visible)
    - [x] Estilos para "Eliminar todas" y el trigger "Ver todas"
    - [x] Sin colores Tailwind arbitrarios — tokens del DS

- [x] **T3.4** — Crear `NotificationsHistoryDrawerComponent` (Organismo)
  - **AC ref:** AC4, AC6
  - **DoD:**
    - [x] `features/notificaciones-historial/notifications-history-drawer.component.ts` — **NO**
      en `shared/` como decía el plan original: el Architect Guard (hook mecánico, sin excepción
      para el patrón Organismo que sí documenta `architecture.md`) bloquea cualquier
      `inject(*Facade)` bajo `shared/` en un Write nuevo. El precedente real de ~30 drawers con
      Facade del proyecto ya vive bajo `features/` (`ajustes-drawer` es la única excepción
      grandfathered) — se siguió ese precedente en vez de pelear contra el hook.
    - [x] OnPush
    - [x] Inyecta `NotificationsFacade` directamente
    - [x] `ngOnInit()` llama `facade.loadHistorial()`
    - [x] Reutiliza el layout de fila de `InstructorNotificacionesComponent` (icono circular +
      título/mensaje/hora), adaptado al ancho de un drawer
    - [x] Cada fila es su propio `.card` (no una lista plana sobre el `bg-base` del drawer) — el
      body de `LayoutDrawerComponent` pinta `bg-base`, no `bg-surface`; sin `.card` por fila el
      contenido queda como texto plano sobre gris, sin separación visual. Corregido tras QA visual
      del owner (2026-09-04), mismo patrón que `alumnos-por-vencer-drawer.component.ts` (`class="card p-3 ..."` por fila) — precedente ya establecido para listas dentro de drawers, no seguido en el primer intento.
    - [x] **NO** distingue visualmente notificaciones eliminadas — decisión final del owner
      (2026-09-04, tras 2 iteraciones: primero badge "Eliminada", luego "Leída", finalmente
      ninguna): el drawer siempre muestra todas, remarcar cuáles fueron eliminadas no aporta
      nada; solo importa leída/no leída (mismo dot que el panel, basado en `n.read`)
    - [x] Cada fila es clicable y marca como leída al hacer clic (`facade.markAsRead(n.id)`),
      mismo comportamiento que `app-notifications-panel` — hallazgo de QA visual del owner: el
      primer intento no tenía ningún handler de click en las filas del drawer
    - [x] `NotificationsFacade.markAsRead()` actualiza tanto `_notifications` (panel) como
      `_historial` (drawer) — son signals independientes con su propio fetch, así que sin este
      ajuste el drawer nunca reflejaba el `read: true` tras marcar desde ahí mismo
    - [x] `<app-icon>` para íconos, sin SVG inline ni emojis
    - [x] Skeleton (`<app-skeleton-block>`) mientras `isHistorialLoading()`, resuelto dentro del
      mismo componente
    - [x] Documentado en `indices/COMPONENTS.md`

- [x] **T3.5** — (Si aplica tras revisar el componente real) `.spec.ts` del drawer
  - **DoD:**
    - [x] No aplicó: el drawer final no tiene `computed()` con lógica de distinción no trivial
      (la distinción activa/eliminada se eliminó por completo tras feedback del owner) — solo
      `@if` directos sobre `n.read`, decisión documentada: NO testear (bindings, no decisión)
      según `testing-tdd.md`

---

## Fase 4 — Conexión y animación

- [x] **T4.1** — Wire-up en `topbar.component.ts`
  - **AC ref:** AC1, AC2, AC5, AC6
  - **DoD:**
    - [x] `(deleteNotification)="notifications.deleteNotification($event)"`
    - [x] `(deleteAllNotifications)="onDeleteAllNotifications()"` → NO llama al Facade directo:
      pasa primero por `ConfirmModalService.confirm()` (severidad `danger`, mismo patrón que
      `onLogout()` en este mismo archivo) antes de invocar `notifications.deleteAllNotifications()`
      — ajuste sobre el plan original tras feedback del owner en QA visual (2026-09-04): una
      eliminación masiva sin confirmar es una acción destructiva que no debía ser inmediata.
    - [x] `(openHistorial)="openNotificationsHistorial()"` → nuevo método que llama
      `layoutDrawer.open(NotificationsHistoryDrawerComponent, 'Historial de Notificaciones', 'bell')`
      (mismo patrón que `AjustesDrawerComponent`)
    - [x] Import del componente nuevo agregado a `topbar.component.ts`

- [x] **T4.2** — Animación de apertura del drawer
  - **DoD:**
    - [x] Verificado: `LayoutDrawerFacadeService` ya anima la apertura (patrón compartido de
      todos los drawers) — no se necesitó animación custom en este componente
    - [x] Drawer sin animación propia de entrada de filas — no hizo falta

---

## Fase 5 — Validación

- [x] **T5.1** — `npm run lint:arch` corre limpio (0 errores)
- [x] **T5.2** — `npm run test:ci` corre verde (2293/2293, incluye los tests nuevos de T2.1)
- [x] **T5.3** — QA manual del happy path + edge cases
  - **AC ref:** todos
  - **DoD:**
    - [x] Eliminar 1 notificación individual → desaparece del panel de inmediato
    - [x] "Eliminar todas" con panel lleno → panel pasa a empty state (con confirmación previa,
      agregada tras feedback del owner)
    - [x] Panel con >10 no eliminadas → muestra máx. 10 + "Ver todas"
    - [x] "Ver todas" desde lista llena Y desde empty state → abre el mismo drawer
    - [x] Drawer muestra activas + eliminadas en una sola lista (decisión final: sin distinguir)
    - [x] AC-E1: eliminar un ítem dentro de un grupo expandido no afecta al resto del grupo
    - [x] AC-E2: eliminadas no cuentan en `unreadCount()` ni en el cap de 10
    - [x] AC-E3: "Eliminar todas" con grupos visibles elimina también los ítems agrupados
    - [x] `/verify` ejecutado: consola limpia (0 errores), sin 4xx, modo oscuro/claro verificado
    - [x] Cada AC marcado con evidencia en `acceptance.md`

- [x] **T5.4** — Ejecutar `/spec-verify`
  - **DoD:** ✅ PASA — 9/9 AC cumplidos con evidencia, ver `acceptance.md`

---

## Fase 6 — Cierre

- [x] **T6.1** — Actualizar `indices/` con todo lo nuevo
  - **DoD:** `FACADES.md`, `COMPONENTS.md`, `DATABASE.md` reflejan lo construido
- [x] **T6.2** — Marcar spec como `done` en `ROADMAP.md`
- [x] **T6.3** — Limpiar `specs/.active` (`/spec-activate --clear`)
- [x] **T6.4** — Marcar Asignación `ASG-i-005` como `completada` en
  `specs/assignments/ASG-i-005-eliminar-notificaciones-y-ver-todas-drawer.md` y correr
  `npm run assignments:sync`

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
