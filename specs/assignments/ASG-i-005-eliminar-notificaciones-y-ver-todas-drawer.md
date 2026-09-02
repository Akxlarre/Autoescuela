# Asignación ASG-i-005 — Eliminar notificaciones (individual/todas) + drawer "Ver todas" con historial completo

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-08-31
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

El panel de notificaciones (`app-notifications-panel`, dropdown desde el Topbar) hoy no
tiene forma de eliminar una notificación individual ni de "eliminar todas" — solo permite
marcar como leídas. Además, si hay muchas notificaciones el panel las muestra todas sin
límite, sin una vista dedicada para revisar el historial completo.

Se necesita: (1) botón para eliminar una notificación puntual y botón para eliminar todas,
(2) el panel debe mostrar como máximo 10 notificaciones y, al final, un link/botón
"Ver todas" que abra un drawer con el historial completo — tanto las notificaciones
existentes como las ya eliminadas, (3) incluso si el panel no tiene ninguna notificación
(empty state), la opción de abrir ese drawer debe seguir disponible.

## Alcance sugerido

- Nuevo(s) método(s) en `NotificationsFacade` para eliminar una notificación y eliminar
  todas — probablemente soft-delete (columna tipo `deleted_at`), no un `DELETE` físico, ya
  que el drawer de "Ver todas" debe poder mostrar también las eliminadas.
- `app-notifications-panel` (Dumb): agregar botón de eliminar por ítem + botón "Eliminar
  todas" + cap de 10 ítems + trigger "Ver todas".
- Nuevo drawer (vía `LayoutDrawerFacadeService`, patrón ya usado en el proyecto) con el
  historial completo (existentes + eliminadas), abierto tanto desde el link "Ver todas" del
  panel como desde el propio empty state cuando no hay notificaciones.
- Evaluar si la migración de BD requiere `ENABLE ROW LEVEL SECURITY` + policy nueva para el
  soft-delete (columna `deleted_at` en la tabla `notifications` existente, no tabla nueva).
- Precedente de layout de historial completo a revisar: `/app/instructor/notificaciones`
  (feed full-page con `NotificationsFacade`) — aunque acá el pedido es un **drawer**, no una
  página, confirmar con el owner si conviene reutilizar ese patrón visual dentro del drawer.

## Referencias

- `.claude/rules/notifications.md` — arquitectura de las 3 capas (Toast/Notificación/Alerta).
  Esta asignación es sobre la Capa 2 (Notificaciones persistentes).
- Ninguna spec previa relacionada directamente.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/notifications.facade.ts`
- `src/app/shared/components/notifications-panel/notifications-panel.component.ts`
- `src/app/layout/topbar.component.ts` (consumidor del panel, probablemente cablea el nuevo
  drawer)
- `supabase/migrations/` (si se agrega `deleted_at` a la tabla `notifications`)

## Notas para quien la reclame

- El pedido original especifica: máximo 10 en el panel, "Ver todas" abre drawer con
  existentes + eliminadas, y la opción de abrir el drawer debe estar visible **incluso en
  el empty state** (no depende de que haya notificaciones para mostrar el acceso al
  historial).
- Confirmar con el owner si "eliminar" es soft-delete (recomendado, dado que el drawer debe
  poder listar las eliminadas) o si hay alguna otra forma de distinguir "eliminada" vs "no
  eliminada" que ya exista en el modelo de datos actual — no asumir sin revisar el DTO real
  de `notifications` primero.
