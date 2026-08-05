# Fix: `cleanup_expired_drafts()` falla cada noche por FK violation con `notifications`
> id: fix-113-m-cleanup-drafts-notifications-fk-violation
> refs: reportado por el dueño vía logs de Postgres (pg_cron), 2026-08-05 03:00 UTC
> status: done
> closed: 2026-08-05
> created: 2026-08-05

## Problema
El cron `cleanup_expired_drafts()` (corre a las 3am, ver DG-050 en
`indices/DOMAIN-GOTCHAS.md`) falla con:

```
ERROR: update or delete on table "users" violates foreign key constraint
"notifications_recipient_id_fkey" on table "notifications"
DETAIL: Key (id)=(165) is still referenced from table "notifications".
CONTEXT: SQL statement "DELETE FROM public.users u WHERE u.id = ANY(orphan_user_ids) ..."
PL/pgSQL function cleanup_expired_drafts() line 65
```

`notifications.recipient_id` (`20260301000008_08_misc_and_triggers.sql:74`) es un
`REFERENCES users(id)` sin `ON DELETE`, así que por defecto es `NO ACTION`. La función
(`20260618140000_fix_cleanup_expired_drafts_orphan_users.sql`) borra `students`/`enrollments`/
etc. asociados al draft expirado, y al final intenta borrar el `user` huérfano (nunca activó
Supabase Auth, no es instructor) — pero **nunca borra las `notifications` que apuntan a ese
`user_id`** (ej. una notificación creada durante el wizard, antes de que el draft expirara).

## Root Cause
Falta de guard: cuando se agregó la limpieza de `users` huérfanos (fix del 2026-06-18), no se
contempló que un `user` recién creado por el wizard puede ya tener notificaciones propias
(`recipient_id`) generadas por triggers de negocio (ej. clases reservadas en el Paso 2 —
ver DG-050) antes de que el draft expirara y fuera descartado por el cron.

## Impacto (importante)
Como la función no tiene bloque `EXCEPTION`, un error sin capturar en PL/pgSQL revierte
**toda la transacción de esa invocación** — no solo el `DELETE` de `users` que falló. Esto
significa que, cada noche que exista al menos un `user` huérfano con notificaciones propias,
**el cron completo aborta y ningún draft expirado de esa corrida se borra** (ni sus
`class_b_sessions`, `payments`, `student_documents`, etc.), aunque el log solo muestre el
error del último `DELETE`. Recomendación operativa: revisar cuántos `enrollments` con
`status='draft'` y `expires_at < NOW()` existen actualmente — es probable que haya un
backlog acumulado desde la primera noche en que apareció este `user` huérfano.

## Cambios
- **Archivo:** `supabase/migrations/20260805100000_fix_cleanup_drafts_orphan_notifications.sql`
  (nueva migración) — `CREATE OR REPLACE FUNCTION cleanup_expired_drafts()` agregando
  `DELETE FROM public.notifications WHERE recipient_id = ANY(orphan_user_ids)` justo antes del
  `DELETE FROM public.users`, siguiendo el mismo patrón de cascade manual ya usado en el resto
  de la función para datos asociados al draft.

## Test de Regresión
No hay test automatizado de funciones PL/pgSQL en este proyecto (sin infraestructura de tests
SQL). Verificación manual: contra Supabase local, crear un `enrollment` draft expirado con un
`user` sin `supabase_uid` que tenga una fila en `notifications.recipient_id`, ejecutar
`SELECT cleanup_expired_drafts();` y confirmar que retorna sin error y que tanto la
notificación como el `user` quedan borrados.
