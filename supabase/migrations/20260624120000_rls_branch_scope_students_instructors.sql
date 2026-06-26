-- ============================================================================
-- Spec 0017 — Secretaria multi-sede (grant del admin)
-- Fase 1 / T1.1 — Endurecer RLS de students e instructors por sede para secretary.
--
-- Contexto:
--  - fix-027 cerró la fuga en el QUERY LAYER (las facades filtran por la sede de la
--    secretaria). Esta migración añade el mismo aislamiento en RLS (defensa real,
--    no eludible) para las dos tablas raíz que HOY no anclan por sede:
--    `select_students` y `select_instructors` usaban `auth_user_role() IN ('admin','secretary')`
--    sin filtro de sede → una secretaria veía todas las sedes a nivel BD.
--
--  - Se REUTILIZA la infraestructura existente (RF-013): la columna
--    `users.can_access_both_branches` y la función `branch_visible(p_branch_id)` ya existen,
--    y `branch_visible` YA devuelve true cuando el caller tiene el grant. Por eso aquí
--    NO se crea columna ni helper: solo se recrean las policies aplicando `branch_visible`
--    sobre la sede del `users` dueño (students/instructors no tienen `branch_id` propio).
--
--  - `select_enrollments` ya usa `branch_visible(branch_id)` → ya honra el grant (sin cambios).
--  - `select_users` NO se toca (fix-002: el selector de destinatarios de Tareas lo necesita
--    abierto; el subquery a `users` de abajo se apoya en esa apertura para el rol secretary).
--
-- Las ramas instructor/student se preservan textualmente de 20260301000011.
-- Idempotente: DROP POLICY IF EXISTS + CREATE.
-- ============================================================================

-- ---------- students ----------
-- Admin: todas | Secretary: solo su sede (branch_visible honra can_access_both_branches)
-- Instructor: alumnos asignados | Student: sí mismo
DROP POLICY IF EXISTS select_students ON public.students;
CREATE POLICY select_students ON public.students
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND branch_visible((SELECT u.branch_id FROM public.users u WHERE u.id = students.user_id)))
    OR (auth_user_role() = 'instructor'
        AND id IN (
          SELECT e.student_id FROM class_b_sessions cb
          JOIN enrollments e ON e.id = cb.enrollment_id
          WHERE cb.instructor_id = auth_instructor_id()
            AND cb.status NOT IN ('cancelled')
        ))
    OR (auth_user_role() = 'student' AND id = auth_student_id())
  );

-- ---------- instructors ----------
-- Admin: todas | Secretary: solo su sede | Instructor: sí mismo | Student: instructor asignado
DROP POLICY IF EXISTS select_instructors ON public.instructors;
CREATE POLICY select_instructors ON public.instructors
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND branch_visible((SELECT u.branch_id FROM public.users u WHERE u.id = instructors.user_id)))
    OR (auth_user_role() = 'instructor' AND id = auth_instructor_id())
    OR (auth_user_role() = 'student'
        AND id IN (
          SELECT cb.instructor_id FROM class_b_sessions cb
          JOIN enrollments e ON e.id = cb.enrollment_id
          WHERE e.student_id = auth_student_id()
            AND cb.status NOT IN ('cancelled')
        ))
  );
