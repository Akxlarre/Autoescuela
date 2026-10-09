-- spec 0049-b (R11 de ASG-i-034): la secretaria solo lee los usuarios que necesita para su sede.
--
-- Antes, `select_users` dejaba a cualquier secretaria leer TODAS las filas de `users` (RUT, teléfono,
-- correo, fecha de nacimiento de personal y alumnos de todas las sedes) — decisión de fix-002-b que
-- la spec 0047-b dejó fuera de alcance. Ahora la secretaria (sin grant multisede) ve:
--   - su sede, los usuarios sin sede y su propia fila;
--   - y, de otras sedes, solo los que su trabajo necesita: personal, instructores "Ambas", instructores
--     con clases de su sede, alumnos con matrícula o curso singular en su sede y pre-inscritos de su sede.
-- Admin, secretaria con grant, instructor y alumno: sin cambios.
--
-- Rendimiento: la parte de "otras sedes" es `id IN (subconsulta sin correlación)`; Postgres la
-- resuelve una vez por consulta (hashed subplan), no fila por fila (lección de fix-196-b).
-- Idempotente (CREATE OR REPLACE + DROP POLICY IF EXISTS).

CREATE OR REPLACE FUNCTION public.secretary_extra_visible_user_ids()
RETURNS SETOF integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  -- 1. Personal (registrado por, autores de tareas y comunicados).
  SELECT u.id
    FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
   WHERE r.name IN ('admin', 'secretary')
  UNION
  -- 2. Instructores "Ambas" (spec 0004-m).
  SELECT i.user_id FROM public.instructors i WHERE i.both_branches
  UNION
  -- 3. Instructores con clases de matrículas de su sede.
  SELECT i.user_id
    FROM public.class_b_sessions cb
    JOIN public.enrollments e ON e.id = cb.enrollment_id
    JOIN public.instructors i ON i.id = cb.instructor_id
   WHERE e.branch_id = public.auth_user_branch_id()
  UNION
  -- 4a. Alumnos con matrícula en su sede (aunque su usuario sea de otra).
  SELECT s.user_id
    FROM public.enrollments e
    JOIN public.students s ON s.id = e.student_id
   WHERE e.branch_id = public.auth_user_branch_id()
  UNION
  -- 4b. Alumnos con curso singular en su sede.
  SELECT s.user_id
    FROM public.standalone_course_enrollments sce
    JOIN public.standalone_courses sc ON sc.id = sce.standalone_course_id
    JOIN public.students s ON s.id = sce.student_id
   WHERE sc.branch_id = public.auth_user_branch_id()
  UNION
  -- 5. Pre-inscritos profesionales de su sede.
  SELECT p.temp_user_id
    FROM public.professional_pre_registrations p
   WHERE p.branch_id = public.auth_user_branch_id()
     AND p.temp_user_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.secretary_extra_visible_user_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretary_extra_visible_user_ids() TO authenticated, service_role;

COMMENT ON FUNCTION public.secretary_extra_visible_user_ids() IS
  'spec 0049-b: usuarios de otras sedes que la secretaria necesita ver (personal, instructores Ambas o con clases de su sede, alumnos/pre-inscritos de su sede).';

DROP POLICY IF EXISTS select_users ON public.users;
CREATE POLICY select_users ON public.users
  FOR SELECT
  -- Los auth_*() van envueltos en (SELECT …): Postgres los evalúa una vez por consulta (initplan) y
  -- no por cada fila. Sin eso la Agenda de la secretaria pasaba de ~16 a ~40 ms; con eso queda igual
  -- y Base Alumnos baja de ~35 a ~24 ms (medido impersonando, test de la spec).
  USING (
    ((SELECT public.auth_user_role()) = 'admin')
    OR (
      (SELECT public.auth_user_role()) = 'secretary'
      AND (
        (SELECT public.auth_can_access_both_branches())
        OR branch_id IS NULL
        OR branch_id = (SELECT public.auth_user_branch_id())
        OR id = (SELECT public.auth_user_id())
        OR id IN (SELECT public.secretary_extra_visible_user_ids())
      )
    )
    OR (
      (SELECT public.auth_user_role()) = ANY (ARRAY['instructor', 'student'])
      AND id = (SELECT public.auth_user_id())
    )
  );
