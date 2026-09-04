# Acceptance 0013-m — Eliminar notificaciones (individual/todas) + drawer "Ver todas" con historial completo

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-09-04
> **Verifier:** Claude (sesión interactiva) · validado por Matías (owner) en vivo con Playwright

---

## Resumen

- AC totales: 9 (AC1–AC6 + AC-E1–AC-E3)
- AC cumplidos: 9
- AC fallidos: 0
- AC con evidencia: 9/9

**Veredicto final:** ✅ PASA

---

## Verificación por AC

### AC1 — Eliminar una notificación individual (soft-delete, desaparece de inmediato)

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `NotificationsFacade.deleteNotification()` (`src/app/core/facades/notifications.facade.ts`) — optimistic remove + `UPDATE notifications SET deleted_at=now() WHERE id=...`.
  - Test: `notifications.facade.spec.ts` → `describe('deleteNotification (AC1)')`, 2 casos (éxito + rollback en error).
  - QA visual en vivo (cuenta `admin@test.com`): clic en botón eliminar de un ítem del panel → desapareció de inmediato sin recarga; `PATCH .../notifications?id=eq.9 => 204` confirmado en Network, sin error RLS.

### AC2 — Eliminar todas (con confirmación previa)

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `NotificationsFacade.deleteAllNotifications()` + `TopbarComponent.onDeleteAllNotifications()` (usa `ConfirmModalService.confirm()`, severidad `danger`, mismo patrón que `onLogout()`).
  - Test: `notifications.facade.spec.ts` → `describe('deleteAllNotifications (AC2, AC-E3)')`, 2 casos.
  - QA visual: modal de confirmación renderizado y probado en vivo (reutilizando el flujo de logout, mismo componente/servicio); botón "Eliminar todas" solo visible con `entries().length > 0`.
  - **Ajuste sobre el AC original**: el owner pidió confirmación antes de ejecutar, tras ver que el primer intento eliminaba de inmediato sin preguntar — incorporado a `spec.md` AC2 el mismo día.

### AC3 — Panel muestra máximo 10 + link "Ver todas"

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `NotificationsFacade.panelEntries` → `.slice(0, 10)` (bajado de 15).
  - Test: `notifications.facade.spec.ts` → `panelEntries` "caps the result at 10".
  - QA visual: cuenta admin con 20+ notificaciones → panel mostró exactamente 10 + trigger "Ver todas" al pie.

### AC4 — Drawer de historial lista activas + eliminadas, sin distinción visual

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `NotificationsHistoryDrawerComponent` (`features/notificaciones-historial/`) + `NotificationsFacade.loadHistorial()` (SELECT sin filtro `deleted_at`, límite 200).
  - QA visual: drawer abierto con cuenta secretaria mostró notificaciones activas y una previamente eliminada en la misma lista, sin badge ni opacidad diferenciada — confirmado tras 2 iteraciones de feedback del owner (primero badge "Eliminada", luego "Leída", finalmente sin distinción).
  - Cada fila es clicable y marca como leída al hacer clic (mismo comportamiento que el panel) — hallazgo de QA visual, incorporado con `onRowClick()` + `NotificationsFacade.markAsRead()` extendido para actualizar también `_historial`.

### AC5 — Trigger "Ver todas" visible incluso en empty state

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: footer `.notif-panel__footer` renderizado siempre, fuera del `@for`/`@empty` del `<ul>`.
  - QA visual: verificado con cuenta admin (panel vacío tras "Eliminar todas") y cuenta instructor (0 notificaciones) — botón "Ver todas" presente en ambos casos, abrió el drawer correctamente (mostró "No tienes notificaciones en tu historial." para instructor).

### AC6 — Drawer reutiliza el layout de `/app/instructor/notificaciones`

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `NotificationsHistoryDrawerComponent` replica el patrón de fila (icono circular + título/mensaje/hora) de `InstructorNotificacionesComponent`, adaptado al ancho del drawer.
  - Corrección post-QA: cada fila es su propio `.card` (no lista plana sobre `bg-base`), mismo patrón que `alumnos-por-vencer-drawer.component.ts` — el primer intento no lo tenía, corregido tras feedback visual del owner.
  - QA visual en modo claro y oscuro (`data-mode="dark"`): cards con contraste correcto en ambos modos, capturas confirmadas.

### AC-E1 — Eliminar un ítem dentro de un grupo colapsado expandido

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: botón eliminar duplicado en la rama `@else` (grupo) del `@for` de `notifications-panel.component.ts`, mismo `deleteNotification.emit(n.id)` que un ítem suelto.
  - No requirió lógica especial en el Facade: `deleteNotification(id)` opera sobre un `id` individual sin importar si venía de un grupo.

### AC-E2 — Eliminadas no cuentan en `unreadCount()` ni en el cap de 10

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `loadNotifications()` agrega `.is('deleted_at', null)` al query — las eliminadas nunca entran a `_notifications`, así que ni `unreadCount()` ni `panelEntries` las ven.
  - Test: `notifications.facade.spec.ts` → `describe('loadNotifications — excluye eliminadas (AC-E2)')`.

### AC-E3 — "Eliminar todas" cubre ítems agrupados

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `deleteAllNotifications()` hace `UPDATE ... WHERE recipient_id = dbId AND deleted_at IS NULL` (no una lista de IDs visibles), así que cubre automáticamente cualquier notificación agrupada en el panel.
  - Test: `notifications.facade.spec.ts` → `describe('deleteAllNotifications (AC2, AC-E3)')` — confirma que el filtro es por `recipient_id`, no por IDs.

---

## Out-of-scope respetado

- ❌ Borrado físico (`DELETE`) — confirmado: la migración solo agrega `deleted_at`, ningún método del Facade hace `DELETE`.
- ❌ UI para "restaurar" una eliminada — confirmado: el drawer solo lista, sin botón de restaurar.
- ❌ Cambios a la lógica de agrupamiento (`groupNotifications()`) — confirmado: sin cambios de firma ni comportamiento, solo se le agregó el botón eliminar a los ítems ya renderizados.
- ❌ Purga automática/TTL — confirmado: no se tocó nada de retención o cron.

---

## Deuda técnica detectada

- **`NotificationsHistoryDrawerComponent` vive en `features/`, no en `shared/`** como decía el plan original — desviación forzada por el Architect Guard (hook mecánico que bloquea `inject(*Facade)` bajo `shared/` sin excepción para el patrón "Organismo" que sí documenta `architecture.md`). No es deuda funcional, pero deja una inconsistencia entre la regla escrita y lo que el hook permite — candidato a que alguien con acceso a `.claude/hooks/` ajuste el guard para reconocer el patrón Organismo (mismo criterio que ya se aplicó a `ajustes-drawer`).
- **Cap de 200 en `loadHistorial()`** — número elegido sin AC explícito, confirmado con el owner en la sesión (2026-09-04) como suficiente sin paginación, apoyado en el umbral de ~300 filas medido en la investigación de virtual scroll del proyecto (spec `0039-b`). Si en el futuro se necesita más, agregar "cargar más" es tarea aislada.
- **`NotificationsHistoryDrawerComponent.component.spec.ts`** no se creó — el componente no tiene `computed()` con lógica no trivial (solo `@if` directos sobre `n.read`), consistente con `testing-tdd.md` §"testea decisiones, no bindings".

---

## Cambios en índices

- `indices/COMPONENTS.md` — `NotificationsHistoryDrawerComponent` agregado; `app-notifications-panel` actualizado con los 3 outputs nuevos y el cap de 10.
- `indices/FACADES.md` — `NotificationsFacade` actualizado con `deleteNotification`, `deleteAllNotifications`, `loadHistorial`, `historial`, `isHistorialLoading`.
- `indices/DATABASE.md` — tabla `notifications`: columna `deleted_at` + índice parcial `idx_notifications_not_deleted` documentados, con nota de por qué no hizo falta RLS nueva.
- `indices/MODELS.md` — no actualizado explícitamente (pendiente, campo `deleted_at`/`deletedAt` en DTO/UI de `notification.model.ts` — deuda menor de documentación, no bloqueante).

---

## Post-mortem

- **Qué salió mejor de lo esperado:** el hallazgo de que `update_notifications`/`select_notifications` ya cubrían "propia fila" sin distinguir `deleted_at` evitó una migración de RLS completa — la spec original ya dejaba esto como pregunta abierta y se resolvió leyendo el código real antes de escribir el plan.
- **Qué fricciones encontramos:**
  1. El Architect Guard bloqueó la ubicación en `shared/` que el plan había propuesto para el drawer (Organismo legítimo per `architecture.md`, pero el hook no tiene esa excepción) — se resolvió siguiendo el precedente real del resto de drawers del proyecto (`features/`) en vez de pelear el hook.
  2. Tres rondas de QA visual del owner sobre el mismo componente nuevo (filas sin card → filas como card; sin confirmación en "eliminar todas" → con confirmación; sin click-to-read en el drawer → con click-to-read; badge "Eliminada" → "Leída" → sin badge) — ninguna de estas se podía haber anticipado solo leyendo la spec/plan; todas salieron de mirar el render real.
- **Qué cambiaríamos en el siguiente ciclo SDD:** para un drawer nuevo con lista de ítems, verificar desde el plan si hay comportamiento de click esperado (mark-as-read, navegación) en vez de asumir que es "solo lectura" — el primer intento del drawer no tenía ningún handler de click, y era la expectativa implícita del owner por paridad con el panel.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados (COMPONENTS, FACADES, DATABASE)
- [x] Tests pasando en CI (29/29 Facade + 34/34 Facade+Topbar combinados + 2293/2293 suite completa)
- [x] `lint:arch` limpio (0 errores)
- [x] Sin deuda crítica abierta (deuda documentada arriba es menor, no bloqueante)

**Cerrado por:** Matías
**Fecha:** 2026-09-04
