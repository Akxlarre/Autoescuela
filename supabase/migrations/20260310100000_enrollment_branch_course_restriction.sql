-- ============================================================================
-- Restricción de tipo de curso por sucursal para secretarias
-- RF: branch_id=1 (Autoescuela Chillán) → solo Clase B + Singular
--     branch_id=2 (Conductores Chillán)  → Clase B + Profesional + Singular
--     admin                              → sin restricción
-- ============================================================================

-- Helper: verifica si el usuario autenticado puede matricular en un tipo de curso dado.
-- Se consulta courses.type para el course_id entregado.
CREATE OR REPLACE FUNCTION auth_can_enroll_course_type(p_course_id INT)
RETURNS BOOLEAN AS $$
  SELECT CASE
    -- Admin: sin restricción
    WHEN public.auth_user_role() = 'admin' THEN TRUE
    -- Secretaria Conductores Chillán (branch 2): puede todo
    WHEN public.auth_user_role() = 'secretary' AND public.auth_user_branch_id() = 2 THEN TRUE
    -- Secretaria Autoescuela Chillán (branch 1): solo class_b y singular (no professional)
    WHEN public.auth_user_role() = 'secretary' AND public.auth_user_branch_id() = 1
      THEN COALESCE(
        (SELECT type != 'professional' FROM public.courses WHERE id = p_course_id),
        TRUE
      )
    ELSE FALSE
  END
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- Actualizar policy INSERT de enrollments para incluir restricción de tipo de curso
DROP POLICY IF EXISTS insert_enrollments ON public.enrollments;
CREATE POLICY insert_enrollments ON public.enrollments
  FOR INSERT WITH CHECK (
    public.auth_user_role() = 'admin'
    OR (
      public.auth_user_role() = 'secretary'
      AND public.branch_visible(branch_id)
      AND public.auth_can_enroll_course_type(course_id)
    )
  );

-- Actualizar policy UPDATE de enrollments para incluir restricción de tipo de curso
DROP POLICY IF EXISTS update_enrollments ON public.enrollments;
CREATE POLICY update_enrollments ON public.enrollments
  FOR UPDATE USING (
    public.auth_user_role() = 'admin'
    OR (
      public.auth_user_role() = 'secretary'
      AND public.branch_visible(branch_id)
      AND public.auth_can_enroll_course_type(course_id)
    )
  );
