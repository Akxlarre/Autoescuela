# Fix: una secretaria solo puede crear notificaciones para usuarios de su sede
> id: fix-234-b-secretaria-notifica-solo-su-sede
> refs: ASG-i-035 (checklist 035, S21 · O08)
> status: done
> created: 2026-10-20

## Root Cause
La policy `insert_notifications` solo exigía `auth_user_role() IN ('admin','secretary')`: una
secretaria podía crear, con cualquier texto, notificaciones para cualquier usuario de cualquier sede
(confirmado en la BD). Que el admin lea las de todos queda como está (es el dueño).

Decisión del owner (2026-10-20): la secretaria solo notifica a usuarios de su sede.

## ACs Afectados
- Aislamiento por sede (spec 0047-b) aplicado a `notifications`.

## Cambio
- Migración `supabase/migrations/20261020130000_fix234_notifications_insert_por_sede.sql`:
  - función `public.secretary_can_notify(p_recipient_id int)` — `SECURITY DEFINER` (la secretaria no
    puede leer usuarios de otra sede), `STABLE`, `search_path` vacío; verdadera si el destinatario es
    de una sede que ella ve (`branch_visible`, que incluye al admin sin sede y el grant multisede) o es
    un instructor con `both_branches` (tareas, fix-233-b). `REVOKE` de `PUBLIC` + `GRANT EXECUTE` a
    `authenticated` y `service_role` en la misma migración.
  - `insert_notifications`: admin igual que antes; secretaria con `secretary_can_notify(recipient_id)`.
  Las notificaciones de triggers `SECURITY DEFINER` y Edge Functions (service role) no pasan por esta
  policy.
- Test `supabase/tests/notificaciones/fix-234-b-notifica-solo-su-sede.sql`.

## Test de Regresión
- Test SQL impersonando a `secretaria@test.com` (sede 1) y a la secretaria multisede, en sub-bloques
  que abortan: alumno de su sede, admin → se crea; secretaria/alumno de la otra sede → 42501;
  instructor "ambas sedes" de la otra sede → se crea; multisede → alumno de la otra sede se crea.
- e2e `comunicacion-tareas.spec.ts` (notificaciones de tareas secretaria ↔ admin siguen llegando).

## Verificación
- Antes de la migración: 3 casos de otra sede se creaban (S21 confirmada).
- Aplicada en producción y registrada (2026-10-20). `authenticated` tiene EXECUTE sobre `secretary_can_notify`.
- Test SQL 8/8; sin residuos.
- e2e `comunicacion-tareas` + `comunicacion-notificaciones` 18/18 (las notificaciones de tareas secretaria ↔ admin siguen llegando).
- `lint:arch` sin errores.
