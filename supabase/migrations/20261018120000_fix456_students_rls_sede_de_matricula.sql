-- ============================================================================
-- fix-456-m: la secretaria ve a los alumnos matriculados en su sede, aunque el alumno sea de la otra
-- ============================================================================
-- La sede de un alumno vive en `users.branch_id` (un solo valor), pero cada matrícula tiene su
-- propia `enrollments.branch_id` (spec 0007-m: re-matrícula en la otra sede). `select_students`
-- solo miraba `users.branch_id`, así que un alumno de la sede 2 con matrícula activa en la sede 1
-- era invisible para la secretaria de la sede 1 en toda la app (DMS, Base Alumnos…), aunque ella
-- ya podía leer esa matrícula y sus documentos. Confirmado el 2026-10-18 con el alumno id 84
-- (matrícula #0008): `enrollments` → 1 fila, `v_dms_student_documents` → 2, `students` → 0.
--
-- Cambio: la cláusula de la secretaria suma "tiene alguna matrícula en mi sede". Pertenencia con
-- IN (subquery) no correlacionado y la sede como InitPlan — una evaluación por consulta, mismo
-- patrón de rendimiento que 20260723030000 (DG-016/DG-098). Sin recursión: `select_enrollments`
-- no consulta `students`.
--
-- Solo SELECT. insert/update/delete_students no cambian.
-- Idempotente: DROP POLICY IF EXISTS + CREATE POLICY.
-- Rollback: recrear la policy de 20260723030000_fix_students_rls_branch_visible_performance.sql.
-- Verificación: supabase/tests/rls/fix-456-m-students-sede-de-matricula.sql
-- ============================================================================

DROP POLICY IF EXISTS select_students ON public.students;
CREATE POLICY select_students ON public.students
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (
      auth_user_role() = 'secretary'
      AND (
        (SELECT auth_can_access_both_branches())
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = students.user_id
            AND u.branch_id = (SELECT auth_user_branch_id())
        )
        OR id IN (
          SELECT e.student_id FROM public.enrollments e
          WHERE e.branch_id = (SELECT auth_user_branch_id())
        )
      )
    )
    OR (auth_user_role() = 'instructor'
        AND id IN (
          SELECT e.student_id FROM public.class_b_sessions cb
          JOIN public.enrollments e ON e.id = cb.enrollment_id
          WHERE cb.instructor_id = auth_instructor_id()
            AND cb.status != 'cancelled'
        ))
    OR (auth_user_role() = 'student' AND id = auth_student_id())
  );
