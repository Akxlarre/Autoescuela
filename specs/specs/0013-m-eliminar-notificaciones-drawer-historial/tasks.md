# Tasks 0013-m — Eliminar notificaciones (individual/todas) + drawer "Ver todas" con historial completo

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
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

- [ ] **T3.1** — Extender `notifications-panel.component.ts` (Dumb) — botones de eliminar
  - **AC ref:** AC1, AC-E1
  - **DoD:**
    - [ ] Nuevo `output()`: `deleteNotification = output<string>();`
    - [ ] Botón eliminar en ítem `single` (icon button, `data-llm-action="delete-notification"`)
    - [ ] Botón eliminar también en ítems anidados dentro de un grupo expandido (AC-E1) — mismo
      output, mismo id individual
    - [ ] Sigue siendo Dumb: solo `input()`/`output()`, sin Facades inyectadas
    - [ ] Tokens de color (sin Tailwind hardcodeado) para el ícono/botón de eliminar

- [ ] **T3.2** — Extender `notifications-panel.component.ts` — "Eliminar todas" + "Ver todas"
  - **AC ref:** AC2, AC3, AC5
  - **DoD:**
    - [ ] Nuevo `output()`: `deleteAllNotifications = output<void>();` y
      `openHistorial = output<void>();`
    - [ ] Botón "Eliminar todas" visible cuando `entries().length > 0` (junto a "Marcar todo
      como leído" en el header, mismo patrón condicional)
    - [ ] Trigger "Ver todas" (`data-llm-action="open-notifications-history"`) SIEMPRE visible —
      tanto al final de la lista con ítems como dentro del bloque `@empty` (AC5)
    - [ ] `panelEntries` ya viene cortado a 10 desde el Facade (T2.4) — el componente no
      re-implementa el cap

- [ ] **T3.3** — Estilos nuevos en `notifications-panel.component.scss`
  - **DoD:**
    - [ ] Estilos para el botón eliminar por ítem (hover/focus visible)
    - [ ] Estilos para "Eliminar todas" y el trigger "Ver todas"
    - [ ] Sin colores Tailwind arbitrarios — tokens del DS

- [ ] **T3.4** — Crear `NotificationsHistoryDrawerComponent` (Organismo)
  - **AC ref:** AC4, AC6
  - **DoD:**
    - [ ] `shared/components/notifications-history-drawer/notifications-history-drawer.component.ts`
    - [ ] OnPush
    - [ ] Inyecta `NotificationsFacade` directamente (permitido: Organismo con Facade de su
      propio dominio, se abre sin padre vía `LayoutDrawerFacadeService` — no puede recibir
      `input()`)
    - [ ] `ngOnInit()` llama `facade.loadHistorial()`
    - [ ] Reutiliza el layout de fila de `InstructorNotificacionesComponent` (icono circular +
      título/mensaje/hora), adaptado al ancho de un drawer — NO layout inventado desde cero
    - [ ] Distingue visualmente notificaciones eliminadas (`deletedAt` no nulo) — ej. opacidad
      reducida + badge "Eliminada" con `.micro-label`
    - [ ] `<app-icon>` para íconos, sin SVG inline ni emojis
    - [ ] Skeleton (`<app-skeleton-block>`) mientras `isHistorialLoading()`, resuelto dentro del
      mismo componente (no un `*-skeleton.component.ts` separado)
    - [ ] Documentado en `indices/COMPONENTS.md`

- [ ] **T3.5** — (Si aplica tras revisar el componente real) `.spec.ts` del drawer
  - **DoD:**
    - [ ] Solo si el drawer tiene un `computed()` con lógica de distinción activa/eliminada
      no trivial — si es un `@if` directo sobre `notif.deletedAt`, se documenta la decisión de
      NO testear (bindings, no decisión) según `testing-tdd.md`

---

## Fase 4 — Conexión y animación

- [ ] **T4.1** — Wire-up en `topbar.component.ts`
  - **AC ref:** AC1, AC2, AC5, AC6
  - **DoD:**
    - [ ] `(deleteNotification)="notifications.deleteNotification($event)"`
    - [ ] `(deleteAllNotifications)="notifications.deleteAllNotifications()"`
    - [ ] `(openHistorial)="openNotificationsHistorial()"` → nuevo método que llama
      `layoutDrawer.open(NotificationsHistoryDrawerComponent, 'Historial de Notificaciones', 'bell')`
      (mismo patrón que `AjustesDrawerComponent`)
    - [ ] Import del componente nuevo agregado a `topbar.component.ts`

- [ ] **T4.2** — Animación de apertura del drawer
  - **DoD:**
    - [ ] Verificar que `LayoutDrawerFacadeService` ya anima la apertura (patrón compartido de
      todos los drawers) — no se necesita animación custom en este componente
    - [ ] Si el drawer necesita alguna animación propia de entrada de filas, usa
      `GsapAnimationsService` (nunca `@keyframes` para entradas)

---

## Fase 5 — Validación

- [ ] **T5.1** — `npm run lint:arch` corre limpio
- [ ] **T5.2** — `npm run test:ci` corre verde (incluye los tests nuevos de T2.1)
- [ ] **T5.3** — QA manual del happy path + edge cases
  - **AC ref:** todos
  - **DoD:**
    - [ ] Eliminar 1 notificación individual → desaparece del panel de inmediato
    - [ ] "Eliminar todas" con panel lleno → panel pasa a empty state
    - [ ] Panel con >10 no eliminadas → muestra máx. 10 + "Ver todas"
    - [ ] "Ver todas" desde lista llena Y desde empty state → abre el mismo drawer
    - [ ] Drawer muestra activas + eliminadas, distinguibles
    - [ ] AC-E1: eliminar un ítem dentro de un grupo expandido no afecta al resto del grupo
    - [ ] AC-E2: eliminadas no cuentan en `unreadCount()` ni en el cap de 10
    - [ ] AC-E3: "Eliminar todas" con grupos visibles elimina también los ítems agrupados
    - [ ] `/verify` ejecutado: consola limpia, sin 4xx, modo oscuro/claro, responsive del drawer
    - [ ] Cada AC marcado con evidencia en `acceptance.md`

- [ ] **T5.4** — Ejecutar `/spec-verify`
  - **DoD:** AC Verifier devuelve `{ok: true}` o tickets restantes resueltos

---

## Fase 6 — Cierre

- [ ] **T6.1** — Actualizar `indices/` con todo lo nuevo (`/sync-indices`)
  - **DoD:** `FACADES.md`, `MODELS.md`, `COMPONENTS.md`, `DATABASE.md` reflejan lo construido
- [ ] **T6.2** — Marcar spec como `done` en `ROADMAP.md`
- [ ] **T6.3** — Limpiar `specs/.active` (`/spec-activate --clear`)
- [ ] **T6.4** — Marcar Asignación `ASG-i-005` como `completada` en
  `specs/assignments/ASG-i-005-eliminar-notificaciones-y-ver-todas-drawer.md` (manual, no se
  sincroniza solo) y correr `npm run assignments:sync`

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
