# Fix: RLS de audit_log no permite a la secretaria ver sus propias acciones

> id: fix-224-m-secretaria-lee-sus-propias-acciones-audit-log
> refs: —
> status: done
> closed: 2026-08-25
> created: 2026-08-25

## Root Cause

`audit_log` tiene una única policy de `SELECT` (`20260301000011_10_rls_policies.sql:183-184`):
`USING (auth_user_role() = 'admin')`. Ninguna secretaria puede leer ninguna fila de `audit_log`
bajo ninguna circunstancia — no por sede, no por autoría propia. El widget "Actividad reciente"
del dashboard de secretaria (`dashboard.facade.ts:176-185`) consulta esa misma tabla: la query
siempre vuelve vacía por RLS, sin importar qué acciones reales haya hecho la secretaria (varias,
confirmadas por el usuario durante días de uso real). El trigger `log_change()` sí registra sus
acciones (solo excluye explícitamente al actor `admin`, no a `secretaria`/`instructor`) — el dato
existe en la tabla, pero es ilegible para ella por RLS.

Confirmado con Playwright: logueada como secretaria, "Actividad reciente" mostró "Sin actividad
reciente" incluso después de registrar una acción real en su sesión (un pago) — mientras que el
admin sí ve las acciones de otras secretarias (ej. "Maria Torres modificó...") en su propio
dashboard.

## ACs Afectados

Ninguno — fix autónomo (hallazgo de negocio, decisión explícita del dueño: "se puede ampliar la
política para que la secretaria vea solo sus propias acciones como mínimo").

## Cambio

- **Archivo nuevo:** `supabase/migrations/<timestamp>_audit_log_secretaria_lee_propias_acciones.sql`
  Reemplaza la policy `select_audit_log`: admin sigue viendo todo; cualquier usuario autenticado
  (secretaria incluida) puede ver además las filas donde `user_id = auth_user_id()` (su propio
  `users.id`, vía el helper ya existente `auth_user_id()`).
  ```sql
  DROP POLICY IF EXISTS select_audit_log ON audit_log;
  CREATE POLICY select_audit_log ON audit_log
    FOR SELECT USING (auth_user_role() = 'admin' OR user_id = auth_user_id());
  ```
  No se toca el trigger `log_change()` ni la lógica del Facade — el filtro por sede
  (`branch_id.eq.X OR branch_id.is.null`) del Facade sigue aplicando sobre las filas que la RLS
  ahora sí deja pasar.

## Test de Regresión

Migración SQL de política, sin lógica de decisión en TypeScript — no aplica test unitario.
Migración aplicada y confirmada por el usuario directamente contra la BD real.
