# Fix: log_change() atribuye "Sistema / Online" en vez del usuario real — cast roto de UUID a INT
> id: fix-103-m-auditoria-atribucion-autor-first-login
> refs: fix-099-m-audit-log-header-user-id-perdido
> status: done
> closed: 2026-08-02
> created: 2026-08-02

## Root Cause

En `log_change()` (vigente en `supabase/migrations/20260801140000_audit_log_restore_header_user_id.sql`,
líneas 92-99), el Fallback 3 de resolución de `v_user_id` es:

```sql
v_user_id := (NULLIF(current_setting('request.jwt.claim.sub', true), ''))::INT;
```

`request.jwt.claim.sub` es el **UUID** de Supabase Auth (`auth.uid()`), no el `id` serial
de `public.users`. Castear un string UUID (ej. `"a1b2c3d4-...-..."`) a `INT` **siempre lanza
una excepción**, atrapada por el `EXCEPTION WHEN OTHERS THEN v_user_id := NULL` que envuelve
ese mismo bloque — es decir, este fallback nunca ha podido resolver un usuario real, para
ninguna tabla ni ninguna acción hecha desde una sesión autenticada normal (no Edge Function).

El proyecto ya tiene la función correcta para este mapeo, usada en las políticas RLS
(`supabase/migrations/20260301000011_10_rls_policies.sql:23-26`):

```sql
CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS INT AS $$
  SELECT id FROM public.users WHERE supabase_uid = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';
```

Esto explica el reporte del dueño: un instructor completando su primer login ejecuta el RPC
`user_complete_first_login()` (`supabase/migrations/20260303000001_...sql`), que corre con la
sesión del propio instructor (`auth.uid()` = su UUID, no un Edge Function con service role,
por lo que no hay header `x-audit-user-id`). La tabla `users` no tiene columna `registered_by`
(Fallback 2 no aplica). El único fallback disponible (3) está roto → `v_user_id = NULL` →
el frontend (`DashboardFacade`) etiqueta la fila como "Sistema / Online" en vez del nombre del
instructor. El mismo problema afecta a cualquier UPDATE/INSERT/DELETE hecho desde sesión
autenticada normal sobre una tabla sin `registered_by` (`users`, `students`, `vehicles`,
`vehicle_documents`, `promotion_courses`, `website_config`, entre otras).

No es un bug de notificaciones (no existe tal notificación — ver investigación previa): es
exactamente este mismo mecanismo de atribución de `audit_log`, consumido por "Actividad
reciente" del dashboard.

## ACs Afectados
- Ninguno — fix autónomo (reportado por el dueño: notificación de "first_login" atribuida a
  "Sistema / Online" en vez del instructor real).

## Cambio
- **Archivo:** `supabase/migrations/20260802130000_audit_log_fix_jwt_sub_cast.sql` (nuevo)
- **Qué cambia:** `CREATE OR REPLACE FUNCTION public.log_change()` — mismo cuerpo vigente
  (el de `20260802120000_audit_log_humanize_columns_and_values.sql`, fix-102-m), con el
  Fallback 3 corregido:
  ```sql
  -- Antes (roto — sub es UUID, no INT):
  v_user_id := (NULLIF(current_setting('request.jwt.claim.sub', true), ''))::INT;

  -- Después (resuelve el id serial vía supabase_uid, igual que auth_user_id()):
  SELECT id INTO v_user_id
  FROM public.users
  WHERE supabase_uid = NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
  ```
  Envuelto en el mismo `BEGIN...EXCEPTION WHEN OTHERS` que ya existía, para tolerar sesiones
  sin JWT (llamadas internas/SQL directo).

## Test de Regresión — VERIFICADO 2026-08-02 contra Supabase local
`npx supabase db push --local` aplicó la corrección sin errores. Confirmado con
`pg_get_functiondef('public.log_change'::regproc)` que el Fallback 3 vigente en BD resuelve
por `supabase_uid`, no por cast directo.

Prueba (fixture + `SET LOCAL request.jwt.claim.sub` simulando la sesión del instructor +
UPDATE + SELECT, todo dentro de una transacción con `ROLLBACK` final):

```sql
SET LOCAL request.jwt.claim.sub = '<supabase_uid del instructor de prueba>';
UPDATE users SET first_login = false WHERE id = 9002;
SELECT user_id, detail FROM audit_log WHERE entity='users' AND entity_id=9002 ORDER BY id DESC LIMIT 1;
```

Resultado:
```
user_id | detail
9002    | [Carlos Instructor] Primer inicio de sesión: true -> false
```

`user_id = 9002` (el instructor real, antes habría sido `NULL` → "Sistema / Online"). ✓
