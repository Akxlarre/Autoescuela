-- ============================================================================
-- Corregir recursión infinita en políticas RLS: enrollments ↔ class_b_sessions
-- ============================================================================
-- Problema: La política select_enrollments (instructor) consulta class_b_sessions.
-- La política select_class_b_sessions (student) consulta enrollments.
-- Al evaluar una, se dispara la otra → recursión infinita.
--
-- Solución: Función SECURITY DEFINER que devuelve los enrollment_ids permitidos
-- para el instructor actual, leyendo class_b_sessions sin RLS (bypass).
-- ============================================================================

CREATE OR REPLACE FUNCTION instructor_enrollment_ids()
RETURNS SETOF INT AS $$
  SELECT enrollment_id
  FROM public.class_b_sessions
  WHERE instructor_id = public.auth_instructor_id()
    AND status NOT IN ('cancelled')
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

COMMENT ON FUNCTION instructor_enrollment_ids() IS
  'Devuelve los enrollment_ids de sesiones del instructor actual. SECURITY DEFINER para evitar recursión RLS entre enrollments y class_b_sessions.';

-- Recrear política select_enrollments usando la función (rompe el ciclo)
DROP POLICY IF EXISTS select_enrollments ON enrollments;

CREATE POLICY select_enrollments ON enrollments
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
    OR (auth_user_role() = 'instructor' AND id IN (SELECT instructor_enrollment_ids()))
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );
