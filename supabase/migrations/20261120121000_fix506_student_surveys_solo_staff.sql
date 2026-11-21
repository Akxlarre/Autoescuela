-- ============================================================================
-- fix-506-m: las encuestas de egreso solo las leen admin y secretaria
-- ============================================================================
-- En la BD real la única política de student_surveys era "Allow authenticated read surveys"
-- (USING true, creada desde el SQL Editor): cualquier usuario con sesión, alumnos e instructores
-- incluidos, leía todas las encuestas y sus comentarios. Las únicas pantallas que las leen son las
-- de ex-alumnos de admin y secretaria (ExAlumnosFacade). Las escrituras no cambian: sin política
-- de INSERT/UPDATE/DELETE, RLS las rechaza para authenticated, como hoy.
-- Test: supabase/tests/rls/fix-506-m-student-surveys-y-pending-payment.sql
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated read surveys" ON public.student_surveys;
DROP POLICY IF EXISTS "Surveys visibles para Admin y Sec" ON public.student_surveys;
DROP POLICY IF EXISTS select_student_surveys_staff ON public.student_surveys;

CREATE POLICY select_student_surveys_staff ON public.student_surveys
  FOR SELECT TO authenticated
  USING (public.auth_user_role() IN ('admin', 'secretary'));
