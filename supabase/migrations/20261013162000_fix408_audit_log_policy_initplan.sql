-- ============================================================================
-- fix-408-m — "Actividad reciente" lenta: la política de audit_log evaluaba sus
-- funciones por fila.
--
-- select_audit_log era (auth_user_role() = 'admin') OR (user_id = auth_user_id()).
-- Sin envolver, Postgres llama a las dos funciones por cada fila que recorre
-- (DG-016), y cada una consulta a users. Pedir las últimas 6 acciones de un
-- usuario con pocas filas propias recorría casi toda la tabla: 2,4 s con 71.608
-- filas, y timeout (57014) con varias sesiones a la vez.
--
-- Misma regla, con las funciones dentro de (SELECT …): se evalúan una vez por
-- consulta y el motor puede usar idx_audit_log_user (user_id, created_at DESC).
-- No cambia qué filas ve cada rol.
--
-- Idempotente: DROP POLICY IF EXISTS + CREATE POLICY.
-- ============================================================================

SET lock_timeout = '5s';

DROP POLICY IF EXISTS select_audit_log ON public.audit_log;

CREATE POLICY select_audit_log ON public.audit_log
  FOR SELECT
  USING (
    (SELECT public.auth_user_role()) = 'admin'
    OR user_id = (SELECT public.auth_user_id())
  );
