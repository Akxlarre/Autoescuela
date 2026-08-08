-- ============================================================================
-- RLS: instructor no podía ver la fila de `users` de sus propios alumnos (fix-122-b)
-- ============================================================================
-- Problema: `select_users` (única policy SELECT sobre `public.users`) solo permite a un
-- instructor/alumno ver su PROPIA fila (`id = auth_user_id()`). Varias queries del portal
-- instructor (`instructor-clases.facade.ts`: fetchTodayClasses(), loadClassDetail()) hacen
-- `students!inner(..., users!inner(...))` para traer el nombre del ALUMNO. Con ese RLS, el
-- `users!inner` del alumno siempre devuelve 0 filas para un instructor autenticado, y al ser
-- `!inner` (no `left`), PostgREST descarta la fila completa aunque class_b_sessions/enrollments/
-- students sí sean visibles por sus propias policies. Síntoma: "Clase no encontrada" para
-- cualquier instructor real, descubierto verificando fix-121-b con datos reales.
--
-- ⚠️ Intento previo (mismo archivo, revertido en producción con `DROP POLICY
-- select_users_via_class_relationship`): una policy que consultaba `students`/`enrollments`/
-- `class_b_sessions` DIRECTO en el USING de `users` causó `42P17: infinite recursion detected in
-- policy for relation "users"`. Causa: `select_students` (rama secretary) consulta `users`
-- directo (`EXISTS (SELECT 1 FROM users u WHERE u.id = students.user_id ...)`), sin pasar por una
-- función SECURITY DEFINER. Postgres expande las policies en la fase de rewrite de la query,
-- independiente del rol en tiempo de ejecución: `users` -> (mi policy) -> `students` -> (policy de
-- students) -> `users` -> ciclo. Rompió el login para TODOS los roles (no solo instructor).
--
-- Fix correcto: envolver la lógica en una función SECURITY DEFINER, igual que
-- `auth_instructor_id()`/`auth_user_role()` (20260301000011_10_rls_policies.sql) — esas funciones
-- YA consultan `public.users` internamente sin causar recursión, precisamente porque
-- SECURITY DEFINER ejecuta con los privilegios del owner de la función (dueño de las tablas en
-- este proyecto), lo que bypassea RLS en las consultas internas. La policy externa solo llama a
-- la función; nunca referencia `students`/`enrollments`/`class_b_sessions` directo.
-- ============================================================================

DROP POLICY IF EXISTS select_users_via_class_relationship ON public.users;
DROP FUNCTION IF EXISTS public.auth_instructor_can_view_student_user(integer);

CREATE OR REPLACE FUNCTION public.auth_instructor_can_view_student_user(target_user_id integer)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.enrollments e ON e.student_id = s.id
    JOIN public.class_b_sessions cb ON cb.enrollment_id = e.id
    WHERE s.user_id = target_user_id
      AND cb.instructor_id = public.auth_instructor_id()
      AND cb.status <> 'cancelled'
  )
$function$;

COMMENT ON FUNCTION public.auth_instructor_can_view_student_user(integer) IS
  'fix-122-b: SECURITY DEFINER — bypassea RLS de students/enrollments/class_b_sessions en la consulta interna para evitar el ciclo de recursión que causaría referenciarlas directo desde una policy de users (ver comentario de cabecera de esta migración).';

CREATE POLICY select_users_via_class_relationship ON public.users
FOR SELECT
USING (
  auth_user_role() = 'instructor'
  AND public.auth_instructor_can_view_student_user(id)
);

COMMENT ON POLICY select_users_via_class_relationship ON public.users IS
  'fix-122-b: permite a un instructor ver la fila de users de un alumno con el que tiene (o tuvo) una class_b_sessions no cancelada. Necesario para que los !inner joins de fetchTodayClasses()/loadClassDetail() en instructor-clases.facade.ts no descarten la fila completa.';
