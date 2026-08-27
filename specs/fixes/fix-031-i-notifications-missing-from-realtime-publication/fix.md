# Fix: `notifications` no está en la publicación `supabase_realtime` — las notificaciones no llegan en vivo

> id: fix-031-i-notifications-missing-from-realtime-publication
> refs: docs/UAT-PLAN.md (Paquete 6, caso "Notificaciones: una acción de negocio genera
>   notificación al rol correspondiente → aparece en tiempo real sin recargar")
> status: done
> closed: 2026-08-27
> created: 2026-08-27

## Root Cause

`NotificationsFacade.subscribeRealtime()` (`src/app/core/facades/notifications.facade.ts:311-329`)
está correctamente implementado: se suscribe a `postgres_changes` INSERT sobre `notifications`
con `filter: recipient_id=eq.{dbId}`. El código cliente no tiene ningún error.

El problema está en la base de datos: la tabla `notifications` **nunca fue agregada a la
publicación `supabase_realtime`** — solo `users` (`20260625120000_enable_realtime_users.sql`),
`tasks` (`20260518000000_create_tasks_and_migrate_observations.sql`) y `class_b_sessions`
(`20260315100000_enable_realtime_class_b_sessions.sql`) lo están. Sin estar en esa publicación,
Postgres/Supabase Realtime nunca emite el evento `postgres_changes` para un `INSERT` en
`notifications`, sin importar qué tan correcto esté el código cliente — el canal se suscribe sin
error visible (no hay excepción, no hay mensaje de consola) porque la suscripción en sí es
válida; simplemente nunca recibe el evento.

Nota curiosa: el comentario de `20260625120000_enable_realtime_users.sql` dice textualmente
*"para que esos eventos lleguen, `users` debe estar en la publicación `supabase_realtime`
(igual que `notifications`, `class_b_sessions`)"* — asumiendo que `notifications` ya estaba
habilitada. Esa asunción nunca se verificó con una migración real; no hay ningún archivo en
`supabase/migrations/` que agregue `notifications` a la publicación.

**Verificado en vivo (UAT, 2026-08-27):** con el panel de notificaciones de `admin@test.com`
abierto, se insertó una fila en `notifications` (`recipient_id=2`) desde una sesión
autenticada distinta (`secretaria@test.com`, simulando una acción de negocio real). El insert
fue exitoso (confirmado leyendo la tabla después), el contador de no-leídas seguía en 3 sin
cambiar y la notificación nunca apareció en el panel abierto. Al recargar la página manualmente,
el contador subió a 4 y la notificación sí aparece — confirma que es un problema puramente de
Realtime (transporte), no de la lógica de negocio ni del fetch inicial.

## ACs Afectados

- Ninguno de una spec formal — fix autónomo descubierto en `docs/UAT-PLAN.md` Paquete 6.

## Cambio

- **Archivo:** `supabase/migrations/20260827000000_fix031_enable_realtime_notifications.sql`
- **Qué cambia:** agrega `public.notifications` a la publicación `supabase_realtime` (idempotente,
  mismo patrón que `20260625120000_enable_realtime_users.sql`). El usuario aplica esta migración
  manualmente contra el proyecto Supabase (`skvekggejikzxhzsjmkz`) — no se ejecuta automáticamente
  desde este entorno.
- No se modifica código TypeScript — `NotificationsFacade` ya está correcto.

## Test de Regresión

No aplica test unitario (la lógica de suscripción ya tenía cobertura previa en
`notifications.facade.spec.ts` — el bug vivía en la configuración de la BD, no en código
testeable con mocks).

**Re-verificado en vivo tras aplicar la migración (2026-08-27):** con el panel de notificaciones
de `admin@test.com` abierto, se insertó una segunda fila de prueba en `notifications`
(`recipient_id=2`) desde una sesión autenticada distinta (`secretaria@test.com`). El contador de
no-leídas subió de 4 a 5 **en vivo, sin recargar la página**, y la notificación apareció agrupada
como "4 tareas · Ahora" en el panel. Sin errores de consola. Confirma que el fix resuelve el
problema end-to-end.
