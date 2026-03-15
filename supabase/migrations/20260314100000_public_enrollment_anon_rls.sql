-- ============================================================================
-- Public Enrollment — Anonymous RLS policies for branches and courses
-- ============================================================================
-- Permite que usuarios anónimos (sin autenticación) puedan leer branches y
-- cursos activos. Necesario para la vista pública de matrícula online (/inscripcion).
-- ============================================================================

-- Branches: lectura anónima (necesario para selector de sede)
CREATE POLICY select_branches_anon ON branches
  FOR SELECT TO anon
  USING (true);

-- Courses: lectura anónima de cursos activos (sin convalidaciones)
CREATE POLICY select_courses_anon ON courses
  FOR SELECT TO anon
  USING (active = true AND (is_convalidation IS NOT TRUE));
