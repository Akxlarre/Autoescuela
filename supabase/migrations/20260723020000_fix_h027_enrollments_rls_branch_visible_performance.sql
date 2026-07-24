-- ============================================================================
-- Fix H-027: 500 (statement timeout) en alertas de asistencia Profesional
-- al filtrar por sede
-- ============================================================================
-- Causa raíz confirmada vía Postgres Logs de producción (SQLSTATE 57014,
-- "canceling statement due to statement timeout"), con contexto:
--   SQL function "auth_can_access_both_branches" during startup
--   SQL function "branch_visible" statement 1
--
-- Las políticas RLS de `enrollments` para el rol secretary llaman
-- branch_visible(branch_id) por cada fila candidata. branch_visible(), a su
-- vez, invoca auth_user_branch_id() y auth_can_access_both_branches() —
-- ambas SECURITY DEFINER, cada una con su propia subconsulta contra `users`.
-- Por ser SECURITY DEFINER, Postgres NO puede inlinearlas dentro del plan
-- de la consulta externa: se ejecutan como llamadas a función opacas, una
-- vez POR FILA de `enrollments` escaneada (no una vez por consulta).
--
-- v_professional_attendance parte de `enrollments` sin ningún filtro previo
-- de sede en la query del facade (dashboard-alerts.facade.ts la deja sin
-- filtrar a propósito, confiando en RLS) — cuando el rol es secretary, esto
-- dispara 2 subconsultas contra `users` POR CADA fila de `enrollments` en
-- todo el sistema, lo que a volumen real de producción excede el
-- statement_timeout. Para admin, la rama `auth_user_role() = 'admin'` hace
-- corto-circuito antes de necesitar branch_visible(), por eso nunca falla.
--
-- Fix: reescribir las políticas de `enrollments` para envolver las llamadas
-- en `(select ...)`. Esto le permite al planner de Postgres tratarlas como
-- InitPlan (evaluadas UNA sola vez por consulta, con resultado cacheado),
-- en vez de una vez por fila — patrón de performance de RLS documentado
-- por Supabase. branch_visible() se mantiene intacta para el resto de
-- tablas que la usan (expenses, cash_closings, standalone_courses, etc.) —
-- no forman parte de este hallazgo y quedan fuera de este fix puntual.
-- ============================================================================

DROP POLICY IF EXISTS select_enrollments ON enrollments;
CREATE POLICY select_enrollments ON enrollments
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (
      auth_user_role() = 'secretary'
      AND (
        branch_id = (SELECT auth_user_branch_id())
        OR (SELECT auth_can_access_both_branches())
      )
    )
    OR auth_user_role() = 'instructor'
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );

DROP POLICY IF EXISTS insert_enrollments ON enrollments;
CREATE POLICY insert_enrollments ON enrollments
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (
      auth_user_role() = 'secretary'
      AND (
        branch_id = (SELECT auth_user_branch_id())
        OR (SELECT auth_can_access_both_branches())
      )
    )
  );

DROP POLICY IF EXISTS update_enrollments ON enrollments;
CREATE POLICY update_enrollments ON enrollments
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (
      auth_user_role() = 'secretary'
      AND (
        branch_id = (SELECT auth_user_branch_id())
        OR (SELECT auth_can_access_both_branches())
      )
    )
  );

DROP POLICY IF EXISTS delete_enrollments ON enrollments;
CREATE POLICY delete_enrollments ON enrollments
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (
      auth_user_role() = 'secretary'
      AND (
        branch_id = (SELECT auth_user_branch_id())
        OR (SELECT auth_can_access_both_branches())
      )
    )
  );
