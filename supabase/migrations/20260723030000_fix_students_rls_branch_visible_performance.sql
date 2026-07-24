-- ============================================================================
-- Fix: RLS de students usa branch_visible() por fila (mismo patrón que
-- fix-060 / H-027 en enrollments)
-- ============================================================================
-- select_students llama branch_visible((SELECT u.branch_id FROM users u
-- WHERE u.id = students.user_id)) para el rol secretary. branch_visible()
-- es SECURITY DEFINER: Postgres no puede inlinearla en el plan externo, así
-- que se ejecuta como llamada a función opaca por cada fila de `students`
-- escaneada, sumada a una subconsulta correlacionada contra `users` por
-- fila (no cacheada). Mismo patrón que causó el statement timeout
-- (SQLSTATE 57014) corregido en enrollments por
-- 20260723020000_fix_h027_enrollments_rls_branch_visible_performance.sql.
--
-- Fix: envolver auth_user_branch_id()/auth_can_access_both_branches() en
-- (select ...) para que Postgres las trate como InitPlan (evaluadas una
-- sola vez por consulta) en vez de una vez por fila de `students`.
-- insert_students/update_students/delete_students no aplican branch scope
-- (son solo role-check) — no requieren cambios.
-- ============================================================================

DROP POLICY IF EXISTS select_students ON students;
CREATE POLICY select_students ON students
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (
      auth_user_role() = 'secretary'
      AND (
        (SELECT auth_can_access_both_branches())
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = students.user_id
            AND u.branch_id = (SELECT auth_user_branch_id())
        )
      )
    )
    OR (auth_user_role() = 'instructor'
        AND id IN (
          SELECT e.student_id FROM class_b_sessions cb
          JOIN enrollments e ON e.id = cb.enrollment_id
          WHERE cb.instructor_id = auth_instructor_id()
            AND cb.status != 'cancelled'
        ))
    OR (auth_user_role() = 'student' AND id = auth_student_id())
  );
