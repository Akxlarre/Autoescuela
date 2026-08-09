-- ============================================================================
-- "Refuerzo Clase B" nunca se ofrece por el flujo público de auto-inscripción
-- (sin login, para leads externos) — spec 0006-m.
--
-- El flujo público (public-enrollment.facade.ts) resuelve cursos por
-- `license_class` sin desambiguar variantes (mismo patrón que tenía el wizard
-- interno antes de esta spec), y nunca fue pensado como canal para un curso
-- dirigido a alumnos que ya pasaron por la autoescuela. Se corrige en la RLS
-- (capa de datos) en vez de replicar el fix de desambiguación en los 7
-- call-sites de ese facade — Refuerzo simplemente no existe para `anon`.
-- ============================================================================

DROP POLICY IF EXISTS select_courses_anon ON courses;

CREATE POLICY select_courses_anon ON courses
  FOR SELECT TO anon
  USING (active = true AND (is_convalidation IS NOT TRUE) AND (is_reinforcement IS NOT TRUE));
