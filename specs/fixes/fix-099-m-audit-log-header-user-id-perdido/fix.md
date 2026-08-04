# Fix: log_change() dejó de leer el header x-audit-user-id — acciones vía Edge Function quedan sin usuario en audit_log
> id: fix-099-m-audit-log-header-user-id-perdido
> refs: —
> status: done
> closed: 2026-08-01
> created: 2026-08-01

## Root Cause

La migración `20260614201000_enrich_audit_log_trigger.sql` reemplazó por completo la función
`log_change()` (en vez de extenderla) para agregar `entity_label` legible y `branch_id`. En
el reemplazo se perdió la resolución de `user_id` vía header HTTP `x-audit-user-id` que había
agregado `20260323120000_fix_audit_log_header_user_id.sql` — necesaria porque las Edge
Functions operan con `SUPABASE_SERVICE_ROLE_KEY` (sin sesión de usuario), así que `auth.uid()`
es `NULL` en esos triggers.

Esa infraestructura sigue activa hoy: `create-secretary`, `update-secretary`,
`create-instructor`, `update-instructor` y `update-student-profile` siguen mandando el header
`x-audit-user-id: <users.id>` en cada request (ver `supabase/functions/*/index.ts`), pero la
función actual nunca lo lee. Resultado: cualquier auditoría generada por esas 5 Edge Functions
queda con `user_id = NULL` (columna Usuario en blanco/"—" en la tabla de Auditoría) en vez de
atribuirse a la secretaria o admin que realmente hizo la acción.

**Ampliación de causa raíz (detectada durante la verificación de este mismo fix):** al probar
`log_change()` contra Supabase local se descubrió que la función **no inserta absolutamente
nada en `audit_log` desde el 14 de junio**. `20260614201000` declara `v_src record;` y luego
usa `v_src->>'id'` — el operador `->>` no existe para el tipo `record`/fila compuesta en
Postgres, solo para `json`/`jsonb`. Esa línea revienta en la primera operación de la función
para **cualquier tabla**, cae al `EXCEPTION WHEN OTHERS` que envuelve toda la función (que solo
hace `RAISE WARNING` sin insertar) y el registro nunca se guarda. Verificado empíricamente:
`UPDATE` de prueba en `vehicles` con `set_config('request.headers', '{"x-audit-user-id":"1"}', true)`
dentro de una transacción con `ROLLBACK` → `WARNING: audit_log error: operator does not exist:
vehicles ->> unknown`, sin fila nueva en `audit_log`. Esto también invalidaba en la práctica el
enriquecimiento de `entity_label` de `fix-097-m` (nunca se alcanza esa lógica) y bloqueaba la
verificación de AC-1/AC-2 de este mismo fix — se corrige aquí porque es la misma función/archivo
que ya se está tocando en ambas migraciones de hoy.

## ACs Afectados

Ninguno — fix autónomo (regresión detectada durante fix-097-m, ver `indices/DOMAIN-GOTCHAS.md#DG-041`).

- AC-1: `log_change()` vuelve a leer el header `x-audit-user-id` (vía
  `current_setting('request.headers', true)`) como prioridad antes de los fallbacks
  existentes (`registered_by`, JWT claim).
- AC-2: El resto de la lógica de `log_change()` (entity_label por tabla, diff de UPDATE,
  branch_id) no cambia de comportamiento.
- AC-3: `v_src` pasa de `record` a `jsonb` (`to_jsonb(OLD)`/`to_jsonb(NEW)`) para que
  `v_src->>'columna'` funcione — `log_change()` vuelve a insertar en `audit_log` para
  cualquier tabla/operación.

## Cambio

- **Archivo:** `supabase/migrations/20260801140000_audit_log_restore_header_user_id.sql`
  **Qué cambia:** `CREATE OR REPLACE FUNCTION log_change()` agrega la lectura del header
  `x-audit-user-id` como primer paso de la resolución de `v_user_id` (antes del fallback
  `registered_by`) y cambia `v_src` de `record` a `jsonb` (`to_jsonb(OLD)`/`to_jsonb(NEW)`)
  para que el operador `->>` funcione y la función vuelva a insertar filas en `audit_log`.

## Test de Regresión

- Verificación manual con Supabase local (`npx supabase db push --local`), vía Docker
  (`docker exec -i supabase_db_Autoescuela psql -U postgres -d postgres`): dentro de una
  transacción con `ROLLBACK`, `set_config('request.headers', '{"x-audit-user-id":"1"}', true)`
  seguido de un `UPDATE` en `vehicles` debe (1) no lanzar `WARNING: audit_log error`, (2)
  insertar una fila en `audit_log` con `user_id = 1`. ✓
