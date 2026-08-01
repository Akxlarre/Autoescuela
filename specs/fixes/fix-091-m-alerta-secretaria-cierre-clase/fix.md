# Fix: Alerta a secretaría cuando un instructor cierra una clase
> id: fix-091-m-alerta-secretaria-cierre-clase
> refs: ASG-b-044
> status: activo
> created: 2026-08-01

## Root Cause
[Heredado de ASG-b-044, a confirmar]: Anotación de la reunión con el cliente
(2026-07-28): "Alerta para secretaria cuando un instructor cierre una clase."

Ya existe el trigger `notify_class_b_completed()`
(`20260710000000_notify_class_b_session_events.sql`, spec 0026): AFTER UPDATE OF status ON
`class_b_sessions`, dispara cuando pasa a `completed` y notifica **al alumno** ("Clase N/12
completada", `reference_type='class_b'`). Es `SECURITY DEFINER` porque el actor es el
instructor, que no tiene permiso de INSERT en `notifications` vía RLS.

Falta extender ese mismo trigger para que también notifique a la secretaría de la sede —
no hay que diseñar nada nuevo.

## ACs Afectados
Ninguno — fix autónomo derivado de Asignación de equipo, ver
`specs/assignments/ASG-b-044-alerta-secretaria-cierre-de-clase.md`.

## Alcance sugerido (de la Asignación)
- Extender `notify_class_b_completed()` para insertar además una notificación dirigida a
  secretaría.
- Resolver **a quién** exactamente: la secretaría de la sede de la matrícula. Si hay varias
  secretarias por sede, definir si se notifica a todas.
- Mantener el `EXCEPTION WHEN OTHERS` que ya tiene, para que un fallo de notificación nunca
  aborte el UPDATE real de la clase.

## Preguntas abiertas (no bloqueante)
1. ¿A todas las secretarias de la sede, o solo a una? Si el volumen de clases diarias es
   alto, esto puede volverse ruido — vale la pena preguntarle al cliente si lo quiere por
   clase o como resumen.

## Notas
- ⚠️ **Se solapa con ASG-b-036** (ciclo de vida de la clase, actualmente 🔴 BLOQUEADA). Si
  esa asignación introduce cierre automático de clases olvidadas, hay que decidir si una
  clase cerrada por el sistema también genera esta alerta — probablemente sí, con texto
  distinto.
- ⚠️ Patrón FK ya documentado: `instructors.id` ≠ `users.id` y `students.id` ≠ `users.id`.
  Resolver siempre el `user_id` real antes de insertar en `notifications`.
- Esto es capa 2 (notificación persistente) según `.claude/rules/notifications.md`, no un
  toast.
- Referencias: `indices/DATABASE.md` → `notify_class_b_completed()`,
  `indices/NOTIFICATIONS-MAP.md` — mapa completo de productores (Olas 1-3).
- Archivos involucrados sugeridos: `supabase/migrations/` (migración nueva que redefine la
  función).
