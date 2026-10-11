-- ============================================================================
-- fix-368-m — Asistencia Clase B: el instructor solo ve y escribe la de SUS clases
-- ============================================================================
-- Hasta acá las políticas SELECT/INSERT/UPDATE de class_b_practice_attendance daban acceso por
-- rol 'instructor' sin mirar la clase (0047-b lo dejó así porque el portal Instructor está fuera
-- del piloto; pero el bloqueo es solo de rutas y la API quedaba abierta). Un instructor leía la
-- asistencia de toda la escuela y podía cambiar una falta ajena a 'excused'.
--
-- Cambia solo la cláusula del instructor. Admin, secretaria (por sede) y alumno (su fila) quedan
-- idénticos a 20261001150000_rls_aislamiento_por_sede.sql. DELETE no cambia. Idempotente.
-- ============================================================================

DROP POLICY IF EXISTS select_class_b_practice_attendance ON public.class_b_practice_attendance;
CREATE POLICY select_class_b_practice_attendance ON public.class_b_practice_attendance
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'instructor'
        AND class_b_session_id IN (
              SELECT cb.id FROM public.class_b_sessions cb
               WHERE cb.instructor_id = (SELECT auth_instructor_id())))
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR class_b_session_id IN (
                  SELECT cb.id FROM public.class_b_sessions cb
                    JOIN public.enrollments e ON e.id = cb.enrollment_id
                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );

DROP POLICY IF EXISTS insert_class_b_practice_attendance ON public.class_b_practice_attendance;
CREATE POLICY insert_class_b_practice_attendance ON public.class_b_practice_attendance
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'instructor'
        AND class_b_session_id IN (
              SELECT cb.id FROM public.class_b_sessions cb
               WHERE cb.instructor_id = (SELECT auth_instructor_id())))
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR class_b_session_id IN (
                  SELECT cb.id FROM public.class_b_sessions cb
                    JOIN public.enrollments e ON e.id = cb.enrollment_id
                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
  );

-- UPDATE sin WITH CHECK explícito: Postgres reutiliza el USING para la fila nueva, así que un
-- instructor tampoco puede mover una fila suya a una clase ajena.
DROP POLICY IF EXISTS update_class_b_practice_attendance ON public.class_b_practice_attendance;
CREATE POLICY update_class_b_practice_attendance ON public.class_b_practice_attendance
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'instructor'
        AND class_b_session_id IN (
              SELECT cb.id FROM public.class_b_sessions cb
               WHERE cb.instructor_id = (SELECT auth_instructor_id())))
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR class_b_session_id IN (
                  SELECT cb.id FROM public.class_b_sessions cb
                    JOIN public.enrollments e ON e.id = cb.enrollment_id
                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
  );
