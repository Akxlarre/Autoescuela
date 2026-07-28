# Asignación ASG-044 — Alerta a secretaría cuando un instructor cierra una clase

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P3
> **created:** 2026-07-28
> **created_by:** b

---

## Contexto / Objetivo

Anotación de la reunión (2026-07-28):

> *"Alerta para secretaria cuando un instructor cierre una clase."*

## Hallazgo — la mitad ya está hecha

Ya existe el trigger **`notify_class_b_completed()`**
(`20260710000000_notify_class_b_session_events.sql`, spec 0026): AFTER UPDATE OF status ON
`class_b_sessions`, dispara cuando pasa a `completed` y notifica **al alumno** ("Clase N/12
completada", `reference_type='class_b'`).

Es `SECURITY DEFINER` justamente porque el actor es el instructor, que no tiene permiso de
INSERT en `notifications` vía RLS.

Esto es **extender ese trigger** para que también notifique a la secretaría de la sede. No hay
que diseñar nada nuevo.

## Alcance sugerido

- Extender `notify_class_b_completed()` para insertar además una notificación dirigida a
  secretaría.
- Resolver **a quién** exactamente: la secretaría de la sede de la matrícula. Si hay varias
  secretarias por sede, definir si se notifica a todas.
- Mantener el `EXCEPTION WHEN OTHERS` que ya tiene, para que un fallo de notificación nunca
  aborte el UPDATE real de la clase.

## Preguntas abiertas (no bloqueante)

1. ¿A todas las secretarias de la sede, o solo a una? Si el volumen de clases diarias es alto,
   esto puede volverse ruido — vale la pena preguntarle al cliente si lo quiere por clase o
   como resumen.

## Referencias

- `indices/DATABASE.md` → `notify_class_b_completed()`
- `indices/NOTIFICATIONS-MAP.md` — mapa completo de productores (Olas 1-3)
- `.claude/rules/notifications.md` — esto es **capa 2 (notificación persistente)**, no un toast
- ⚠️ Patrón FK ya documentado: `instructors.id` ≠ `users.id` y `students.id` ≠ `users.id`.
  Resolver siempre el `user_id` real antes de insertar en `notifications`.

## Archivos involucrados (opcional, para detectar solapes)

- `supabase/migrations/` (migración nueva que redefine la función)

## Notas para quien la reclame

- ⚠️ **Se solapa con ASG-036** (ciclo de vida de la clase). Si ASG-036 introduce cierre
  automático de clases olvidadas, hay que decidir si una clase cerrada por el sistema también
  genera esta alerta — probablemente **sí, y con texto distinto**, porque es justo el caso que
  la secretaría necesita saber.
