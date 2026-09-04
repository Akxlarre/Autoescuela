# Plan 0013-m — Eliminar notificaciones (individual/todas) + drawer "Ver todas" con historial completo

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-09-04

---

## 1. Resumen ejecutivo

Se agrega soft-delete (`deleted_at`) a `notifications` vía una migración de una sola columna
(sin cambios de RLS — `update_notifications`/`select_notifications` ya cubren "propia fila" para
UPDATE y SELECT). `NotificationsFacade` gana `deleteNotification()`, `deleteAllNotifications()` y
un estado nuevo (`historial`) cargado bajo demanda por `loadHistorial()` para el drawer. El panel
(`app-notifications-panel`, dumb) gana botones de eliminar (individual + "eliminar todas") y baja
su cap de 15 a 10 ítems (AC3); gana también un trigger "Ver todas" siempre visible, incluso en el
empty state (AC5). Se crea un drawer nuevo, `NotificationsHistoryDrawerComponent` (organismo —
inyecta `NotificationsFacade`, su propio dominio), que reutiliza el layout de fila ya usado en
`/app/instructor/notificaciones` para listar el historial completo (existentes + eliminadas).
`TopbarComponent` cablea el nuevo drawer vía `LayoutDrawerFacadeService`, mismo patrón que
`AjustesDrawerComponent`.

Orden grueso: migración → DTO/UI models + utils → Facade (+ tests) → dumb panel → drawer nuevo →
conexión en Topbar → QA visual (`/verify`).

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20260904120000_notifications_soft_delete.sql` | Migration | Agrega `deleted_at TIMESTAMPTZ NULL` a `notifications` + índice parcial para el filtro del panel |
| `src/app/shared/components/notifications-history-drawer/notifications-history-drawer.component.ts` | Organismo (drawer) | Historial completo (existentes + eliminadas), abierto vía `LayoutDrawerFacadeService` |
| `src/app/shared/components/notifications-history-drawer/notifications-history-drawer.component.scss` | Estilos | Estilos del drawer (fila de historial, badge "Eliminada") |
| `src/app/shared/components/notifications-history-drawer/notifications-history-drawer.component.spec.ts` | Test | Cubre `computed()` de agrupación por estado (activa/eliminada) si lo hay — ver §7 |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/models/dto/notification.model.ts` | Agregar `deleted_at?: string \| null` | Reflejar la columna nueva de BD (regla `models.md` — DTO espeja la tabla 1:1) |
| `src/app/core/models/ui/notification.model.ts` | Agregar `deletedAt?: Date \| null` a `Notification` | Campo derivado para distinguir eliminadas en el drawer (AC4) |
| `src/app/core/utils/notification.utils.ts` | `mapNotificationDtoToUi`: mapear `deleted_at` → `deletedAt` | Único lugar de transformación DTO→UI permitido para notificaciones |
| `src/app/core/facades/notifications.facade.ts` | Nuevos métodos `deleteNotification(id)`, `deleteAllNotifications()`, `loadHistorial()`; nuevo estado `_historial`/`historial`/`isHistorialLoading`; `loadNotifications()` filtra `deleted_at IS NULL`; `panelEntries` baja el `.slice()` de 15 a 10 | AC1, AC2, AC3, AC-E2 |
| `src/app/shared/components/notifications-panel/notifications-panel.component.ts` | Nuevos `output()`: `deleteNotification`, `deleteAllNotifications`, `openHistorial`; botón eliminar por ítem (single + anidado en grupo); botón "Eliminar todas"; trigger "Ver todas" siempre visible (lista y empty state) | AC1, AC2, AC5, AC-E1, AC-E3 |
| `src/app/shared/components/notifications-panel/notifications-panel.component.scss` | Estilos de los botones nuevos + el trigger "Ver todas" | Soporte visual de lo anterior |
| `src/app/layout/topbar.component.ts` | Cablear los 3 outputs nuevos del panel: `deleteNotification` → `notifications.deleteNotification($event)`, `deleteAllNotifications` → `notifications.deleteAllNotifications()`, `openHistorial` → abrir `NotificationsHistoryDrawerComponent` vía `layoutDrawer.open(...)` | Conectar UI ↔ Facade ↔ Drawer |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `<app-icon>` — íconos del drawer y de los botones de eliminar.
- `LayoutDrawerFacadeService.open(component, title, icon)` — mismo patrón que
  `AjustesDrawerComponent` (`topbar.component.ts:337`), sin `inputs` (drawer sin padre en el
  template, coherente con la regla de "Organismo" de `architecture.md` — se abre dinámicamente).
- Layout de fila (icono circular + título/mensaje/hora + dot de no-leído) de
  `InstructorNotificacionesComponent` — se replica adaptado al ancho del drawer (confirmado con
  el owner: reutilizar el patrón visual, no inventar uno nuevo).

### Facades/Services existentes que extendemos
- `NotificationsFacade` — se le agregan los 3 métodos de eliminación/historial. NO se crea un
  Facade nuevo: el dominio (notificaciones) ya tiene dueño.

### Componentes/Facades que NO existen y debemos crear
- `NotificationsHistoryDrawerComponent` — no hay ningún drawer de listado existente que cubra
  "historial completo con distinción activa/eliminada"; el precedente más cercano
  (`InstructorNotificacionesComponent`) es una página, no un drawer, y el pedido explícito de la
  ASG original es un drawer.

---

## 4. Modelo de datos

### Migración(es) requerida(s)

```sql
-- supabase/migrations/20260904120000_notifications_soft_delete.sql
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL DEFAULT NULL;

-- Índice parcial: acelera el filtro `deleted_at IS NULL` que aplica loadNotifications()
-- (panel + badge + página de instructor) en cada carga.
CREATE INDEX IF NOT EXISTS idx_notifications_not_deleted
  ON notifications (recipient_id, created_at DESC)
  WHERE deleted_at IS NULL;
```

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `notifications` | cualquiera autenticado | UPDATE (soft-delete propio) | **Sin cambios** — `update_notifications` ya permite `recipient_id = auth_user_id()`, cubre setear `deleted_at` en la propia fila |
| `notifications` | cualquiera autenticado | SELECT (historial, incluye eliminadas) | **Sin cambios** — `select_notifications` ya permite `recipient_id = auth_user_id()` sin distinguir `deleted_at`, así que el drawer puede leer ambos estados con la misma policy |

No se requiere migración de RLS — solo la columna. Verificar en `/spec-tasks` que ningún query
existente (`loadNotifications`, Realtime) rompa por la columna nueva (no debería: `SELECT '*'`
la incluye automáticamente, y el trigger Realtime de INSERT no la usa).

### Modelos UI/DTO

- `core/models/dto/notification.model.ts` — agrega `deleted_at?: string | null` (espejo 1:1).
- `core/models/ui/notification.model.ts` — agrega `deletedAt?: Date | null` en `Notification`
  (mapeado desde `deleted_at`, `null`/`undefined` → no eliminada).
- No se crea un modelo de UI nuevo para el drawer — reutiliza `Notification` (ui) tal cual, ya
  tiene todo lo necesario (`title`, `message`, `createdAt`, `deletedAt`, `type`, `referenceType`).

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
TopbarComponent (Smart/Layout)
  ├─ inject(NotificationsFacade)
  ├─ inject(LayoutDrawerFacadeService)
  ├─ <app-notifications-panel>            (Dumb)
  │     input: entries, notifications, unreadCount
  │     output: markRead, markReadMany, markAllRead, notifClicked
  │     output NUEVO: deleteNotification(id), deleteAllNotifications(), openHistorial()
  │
  └─ (click "Ver todas" / empty-state trigger)
        → layoutDrawer.open(NotificationsHistoryDrawerComponent, 'Historial de Notificaciones', 'bell')
              └─ NotificationsHistoryDrawerComponent (Organismo — sin padre, sin inputs)
                    ├─ inject(NotificationsFacade)   ← su propio dominio, permitido
                    ├─ ngOnInit → facade.loadHistorial()
                    └─ renderiza facade.historial() (activas + eliminadas, distinguibles)

NotificationsFacade (Facade)
  ├─ loadNotifications()      → AHORA filtra deleted_at IS NULL
  ├─ deleteNotification(id)   → NUEVO, optimistic + UPDATE deleted_at=now()
  ├─ deleteAllNotifications() → NUEVO, optimistic + UPDATE masivo
  ├─ loadHistorial()          → NUEVO, SELECT sin filtro de deleted_at
  └─ panelEntries             → slice(0, 10) en vez de slice(0, 15)
```

### Capas tocadas

- **Layout (Smart-like)**: `layout/topbar.component.ts`
- **Dumb**: `shared/components/notifications-panel/notifications-panel.component.ts`
- **Organismo (drawer)**: `shared/components/notifications-history-drawer/notifications-history-drawer.component.ts`
- **Facade**: `core/facades/notifications.facade.ts`
- **Utils**: `core/utils/notification.utils.ts`
- **Migration**: `supabase/migrations/20260904120000_notifications_soft_delete.sql`

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — Patrón Facade, OnPush, Signals. El drawer nuevo es Organismo (inyecta
  el Facade de su propio dominio, se abre sin padre vía `LayoutDrawerFacadeService`) — no Dumb.
- [ ] `facades.md` — `NotificationsFacade` NO es branch-scoped (ya documentado en
  `facades.md` §"Facades que NO aplican branch filter" — filtra por `recipient_id`, no cambia).
- [x] `models.md` — DTO (`deleted_at`) vs UI (`deletedAt`) separados, mapeo solo en el Facade/utils.
- [x] `visual-system.md` — tokens semánticos para el badge "Eliminada" (ej. `text-text-muted`,
  sin colores Tailwind arbitrarios); drawer sigue el layout ya validado de la página de instructor.
- [ ] `swr-pattern.md` — el historial se carga on-demand al abrir el drawer (no persiste entre
  aperturas como SWR clásico); no aplica SWR completo, es "solo fetch" (ver tabla de
  `swr-pattern.md` — "Detalle que no se revisita" no encaja del todo, pero tampoco justifica
  cache — decidir en `/spec-tasks` si vale la pena un flag simple para no re-fetch en la misma
  sesión de drawer abierto).
- [x] `notifications.md` — spec es sobre la Capa 2 (Notificaciones persistentes); no crea Toasts
  ni Alertas nuevas.
- [x] `testing-tdd.md` — `.spec.ts` obligatorio para los métodos nuevos de `NotificationsFacade`
  (lógica de negocio: soft-delete, filtro, historial) y para cualquier `computed()` nuevo del
  drawer si distingue activas/eliminadas con lógica no trivial.
- [x] `ai-readability.md` — `data-llm-action="delete-notification"`,
  `data-llm-action="delete-all-notifications"`, `data-llm-action="open-notifications-history"`
  en los botones/link nuevos.

---

## 7. Plan de testing

- **Tests unitarios (`notifications.facade.spec.ts`, ya existe — extender)**:
  - `deleteNotification()`: optimistic update remueve el ítem de `notifications()`; rollback si
    el UPDATE falla.
  - `deleteAllNotifications()`: soft-elimina solo las no eliminadas del usuario actual; rollback
    en error.
  - `loadHistorial()`: incluye ítems con `deleted_at` no nulo (a diferencia de `loadNotifications()`).
  - `loadNotifications()`: verificar que el query ahora excluye `deleted_at IS NOT NULL` (o mock
    del builder confirma el `.is('deleted_at', null)` agregado).
  - `panelEntries`: cap en 10, no 15 (regresión directa de AC3).
- **Tests del drawer** (si tiene `computed()` con lógica de distinción activa/eliminada — evaluar
  en `/spec-tasks`; si es solo `@if` sobre `notif.deletedAt`, no amerita test según
  `testing-tdd.md` §"testea decisiones, no bindings").
- **QA manual + `/verify` (obligatorio, cambio de UI)**:
  - Golden path: eliminar 1 notificación individual, eliminar todas, abrir "Ver todas" desde
    lista llena y desde empty state.
  - Edge case AC-E1: eliminar un ítem dentro de un grupo expandido sin afectar al resto.
  - Edge case AC-E3: "Eliminar todas" con grupos visibles elimina también los ítems agrupados.
  - Verificar consola limpia, sin 4xx, modo oscuro/claro, responsive del drawer.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Bajar el cap del panel de 15 a 10 es un cambio de comportamiento ya establecido (no solo un AC nuevo) — puede sorprender si alguien más lo asumía en 15 | Baja | Documentado explícito en este plan y en el AC3; `/verify` confirma visualmente que no rompe el layout del panel |
| `deleteAllNotifications()` sobre una lista con ítems agrupados (AC-E3) puede fallar si el UPDATE masivo no incluye los IDs "escondidos" dentro de un grupo colapsado | Media | El UPDATE es por `recipient_id + deleted_at IS NULL` (no por lista de IDs visibles en el panel), así que cubre agrupados automáticamente — verificar con test específico, no solo QA visual |
| Índice parcial nuevo sobre `notifications` en producción con historial ya grande — tiempo de creación de índice | Baja | Tabla actualmente pequeña (proyecto en desarrollo); si se aplica manualmente como el resto de migraciones del proyecto (ver `0012-m` precedente), no hay downtime significativo esperado |
| El drawer reutiliza el layout de `instructor-notificaciones` pero ese componente no es reutilizable como está (es standalone completo, no una fila extraída) — riesgo de duplicar HTML en vez de compartir | Media | Aceptado como duplicación consciente y acotada (una fila de lista, ~30 líneas) — extraer un componente compartido sería sobre-ingeniería para una sola reutilización; revisar si se repite una tercera vez antes de abstraer |

---

## 9. Orden de implementación

1. Migración SQL (`deleted_at` + índice parcial) — aplicar manualmente como el resto del proyecto.
2. DTO/UI models (`deleted_at`/`deletedAt`) + `notification.utils.ts` (mapeo).
3. `NotificationsFacade`: nuevos métodos + estado `historial` + ajuste de `loadNotifications()`
   y `panelEntries` + `.spec.ts` extendido.
4. `notifications-panel.component.ts`: botones de eliminar + "Ver todas" + empty state.
5. `NotificationsHistoryDrawerComponent` nuevo (+ scss + spec si aplica).
6. `topbar.component.ts`: cablear outputs nuevos + apertura del drawer.
7. QA manual + `/verify` (golden path + edge cases AC-E1/E2/E3).

---

## 10. Estimación

M — 1 a 2 días (migración simple, sin Facade nuevo, un componente nuevo con layout ya validado
en otra parte del proyecto).

---

## Changelog

- 2026-09-04 — plan inicial por Matías, tras Discovery contra `indices/DATABASE.md`,
  `indices/FACADES.md`, `indices/NOTIFICATIONS-MAP.md` y el código real de
  `NotificationsFacade`/`notifications-panel`/`instructor-notificaciones`.
