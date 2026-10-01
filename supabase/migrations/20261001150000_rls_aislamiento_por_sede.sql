-- ============================================================================
-- spec 0047-b: RLS — aislamiento por sede para la secretaria (tablas del piloto)
-- ============================================================================
-- Contexto (ASG-i-045, confirmado contra la BD remota el 2026-10-01): en estas tablas la
-- cláusula de la secretaria solo exigía el rol, sin mirar la sede. Una secretaria de la sede 1
-- leía las 1.728 clases de ambas sedes, 176 pagos (solo 61 suyos), ventas, anticipos y
-- certificados de la otra sede, y podía insertar/modificar/borrar filas de ella desde la consola.
-- La única barrera era el filtro del facade en el navegador.
--
-- Patrón (todas las policies tocadas):
--   auth_user_role() = 'admin'
--   OR (auth_user_role() = 'secretary' AND <alcance por sede>)
--   OR <cláusulas de instructor/alumno vigentes, copiadas textualmente de pg_policies remoto>
--
-- <alcance por sede> replica branch_visible() (grant multi-sede → todo; sede NULL → visible)
-- pero escrito para que Postgres lo evalúe UNA vez por query, no por fila (DG-016, fix-060/061):
--   · (SELECT auth_can_access_both_branches()) y (SELECT auth_user_branch_id()) → InitPlan
--   · tablas sin branch_id directo: <fk> IN (SELECT id FROM <padre> WHERE <sede>) → subconsulta
--     no correlacionada (hashed SubPlan), nunca una función SECURITY DEFINER por fila.
--
-- UPDATE no declara WITH CHECK: Postgres reutiliza el USING para la fila nueva, así que tampoco
-- se puede mover una fila propia a la otra sede.
--
-- Fuera de alcance (ver spec §4): users, storage, RPC SECURITY DEFINER, tablas de Clase
-- Profesional, flota, service_catalog, acceso amplio del rol instructor.
--
-- Rollback: antes de esta migración la cláusula de la secretaria en cada policy tocada era solo
-- auth_user_role() = ANY (ARRAY['admin','secretary', …]). Revertir = recrear esas policies con
-- el arreglo de roles original (snapshot de pg_policies del 2026-10-01 en
-- specs/specs/0047-b-rls-aislamiento-por-sede/acceptance.md).
--
-- Idempotente: DROP POLICY IF EXISTS + CREATE POLICY. Sin funciones nuevas.
-- Verificación: supabase/tests/rls/0047-b-aislamiento-por-sede.sql
-- ============================================================================


-- ── 1. class_b_sessions (alcance: sede de la matrícula) ─────────────────────

DROP POLICY IF EXISTS select_class_b_sessions ON public.class_b_sessions;
CREATE POLICY select_class_b_sessions ON public.class_b_sessions
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
    OR (auth_user_role() = 'instructor' AND instructor_id = auth_instructor_id())
    OR (auth_user_role() = 'student'
        AND enrollment_id IN (SELECT enrollments.id FROM enrollments
                               WHERE enrollments.student_id = auth_student_id()))
  );

DROP POLICY IF EXISTS insert_class_b_sessions ON public.class_b_sessions;
CREATE POLICY insert_class_b_sessions ON public.class_b_sessions
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
    OR (auth_user_role() = 'instructor' AND instructor_id = auth_instructor_id())
  );

DROP POLICY IF EXISTS update_class_b_sessions ON public.class_b_sessions;
CREATE POLICY update_class_b_sessions ON public.class_b_sessions
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
    OR (auth_user_role() = 'instructor' AND instructor_id = auth_instructor_id())
  );

DROP POLICY IF EXISTS delete_class_b_sessions ON public.class_b_sessions;
CREATE POLICY delete_class_b_sessions ON public.class_b_sessions
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
  );


-- ── 2. class_b_practice_attendance (alcance: sede de la matrícula de la clase) ──
-- La cláusula de instructor (sin filtro) queda igual: portal Instructor fuera del piloto.

DROP POLICY IF EXISTS select_class_b_practice_attendance ON public.class_b_practice_attendance;
CREATE POLICY select_class_b_practice_attendance ON public.class_b_practice_attendance
  FOR SELECT USING (
    auth_user_role() = ANY (ARRAY['admin', 'instructor'])
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
    auth_user_role() = ANY (ARRAY['admin', 'instructor'])
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR class_b_session_id IN (
                  SELECT cb.id FROM public.class_b_sessions cb
                    JOIN public.enrollments e ON e.id = cb.enrollment_id
                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS update_class_b_practice_attendance ON public.class_b_practice_attendance;
CREATE POLICY update_class_b_practice_attendance ON public.class_b_practice_attendance
  FOR UPDATE USING (
    auth_user_role() = ANY (ARRAY['admin', 'instructor'])
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR class_b_session_id IN (
                  SELECT cb.id FROM public.class_b_sessions cb
                    JOIN public.enrollments e ON e.id = cb.enrollment_id
                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS delete_class_b_practice_attendance ON public.class_b_practice_attendance;
CREATE POLICY delete_class_b_practice_attendance ON public.class_b_practice_attendance
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR class_b_session_id IN (
                  SELECT cb.id FROM public.class_b_sessions cb
                    JOIN public.enrollments e ON e.id = cb.enrollment_id
                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
  );


-- ── 3. class_b_theory_sessions (alcance: branch_id directo) ─────────────────

DROP POLICY IF EXISTS select_class_b_theory_sessions ON public.class_b_theory_sessions;
CREATE POLICY select_class_b_theory_sessions ON public.class_b_theory_sessions
  FOR SELECT USING (
    auth_user_role() = ANY (ARRAY['admin', 'instructor', 'student'])
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL OR branch_id = (SELECT auth_user_branch_id())))
  );

DROP POLICY IF EXISTS insert_class_b_theory_sessions ON public.class_b_theory_sessions;
CREATE POLICY insert_class_b_theory_sessions ON public.class_b_theory_sessions
  FOR INSERT WITH CHECK (
    auth_user_role() = ANY (ARRAY['admin', 'instructor'])
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL OR branch_id = (SELECT auth_user_branch_id())))
  );

DROP POLICY IF EXISTS update_class_b_theory_sessions ON public.class_b_theory_sessions;
CREATE POLICY update_class_b_theory_sessions ON public.class_b_theory_sessions
  FOR UPDATE USING (
    auth_user_role() = ANY (ARRAY['admin', 'instructor'])
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL OR branch_id = (SELECT auth_user_branch_id())))
  );

DROP POLICY IF EXISTS delete_class_b_theory_sessions ON public.class_b_theory_sessions;
CREATE POLICY delete_class_b_theory_sessions ON public.class_b_theory_sessions
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL OR branch_id = (SELECT auth_user_branch_id())))
  );


-- ── 4. absence_evidence (alcance: sede de la matrícula) ─────────────────────

DROP POLICY IF EXISTS select_absence_evidence ON public.absence_evidence;
CREATE POLICY select_absence_evidence ON public.absence_evidence
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
    OR (auth_user_role() = 'student'
        AND enrollment_id IN (SELECT enrollments.id FROM enrollments
                               WHERE enrollments.student_id = auth_student_id()))
  );

DROP POLICY IF EXISTS insert_absence_evidence ON public.absence_evidence;
CREATE POLICY insert_absence_evidence ON public.absence_evidence
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
    OR (auth_user_role() = 'student'
        AND enrollment_id IN (SELECT enrollments.id FROM enrollments
                               WHERE enrollments.student_id = auth_student_id()))
  );

DROP POLICY IF EXISTS update_absence_evidence ON public.absence_evidence;
CREATE POLICY update_absence_evidence ON public.absence_evidence
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
    OR (auth_user_role() = 'student'
        AND enrollment_id IN (SELECT enrollments.id FROM enrollments
                               WHERE enrollments.student_id = auth_student_id()))
  );

DROP POLICY IF EXISTS delete_absence_evidence ON public.absence_evidence;
CREATE POLICY delete_absence_evidence ON public.absence_evidence
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
  );


-- ── 5. students (SELECT ya filtraba por sede — fix-061; se alinean INSERT/UPDATE/DELETE) ──
-- Misma regla que select_students: grant multi-sede, o el usuario del alumno es de mi sede.

DROP POLICY IF EXISTS insert_students ON public.students;
CREATE POLICY insert_students ON public.students
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR EXISTS (SELECT 1 FROM public.users u
                         WHERE u.id = students.user_id AND u.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS update_students ON public.students;
CREATE POLICY update_students ON public.students
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR EXISTS (SELECT 1 FROM public.users u
                         WHERE u.id = students.user_id AND u.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS delete_students ON public.students;
CREATE POLICY delete_students ON public.students
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR EXISTS (SELECT 1 FROM public.users u
                         WHERE u.id = students.user_id AND u.branch_id = (SELECT auth_user_branch_id()))))
  );


-- ── 6. payments (DELETE ya era solo admin) ──────────────────────────────────

DROP POLICY IF EXISTS select_payments ON public.payments;
CREATE POLICY select_payments ON public.payments
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
    OR (auth_user_role() = 'student'
        AND enrollment_id IN (SELECT enrollments.id FROM enrollments
                               WHERE enrollments.student_id = auth_student_id()))
  );

DROP POLICY IF EXISTS insert_payments ON public.payments;
CREATE POLICY insert_payments ON public.payments
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS update_payments ON public.payments;
CREATE POLICY update_payments ON public.payments
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
  );


-- ── 7. discount_applications (UPDATE/DELETE ya eran solo admin) ─────────────

DROP POLICY IF EXISTS select_discount_applications ON public.discount_applications;
CREATE POLICY select_discount_applications ON public.discount_applications
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS insert_discount_applications ON public.discount_applications;
CREATE POLICY insert_discount_applications ON public.discount_applications
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
  );


-- ── 8. instructor_advances / instructor_replacements ────────────────────────
-- Alcance: misma regla que select_instructors (sede del usuario del instructor, o "ambas sedes").
-- UPDATE/DELETE ya eran solo admin.

DROP POLICY IF EXISTS select_instructor_advances ON public.instructor_advances;
CREATE POLICY select_instructor_advances ON public.instructor_advances
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR instructor_id IN (SELECT i.id FROM public.instructors i
                                    JOIN public.users u ON u.id = i.user_id
                                   WHERE i.both_branches OR u.branch_id IS NULL
                                      OR u.branch_id = (SELECT auth_user_branch_id()))))
    OR (auth_user_role() = 'instructor' AND instructor_id = auth_instructor_id())
  );

DROP POLICY IF EXISTS insert_instructor_advances ON public.instructor_advances;
CREATE POLICY insert_instructor_advances ON public.instructor_advances
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR instructor_id IN (SELECT i.id FROM public.instructors i
                                    JOIN public.users u ON u.id = i.user_id
                                   WHERE i.both_branches OR u.branch_id IS NULL
                                      OR u.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS select_instructor_replacements ON public.instructor_replacements;
CREATE POLICY select_instructor_replacements ON public.instructor_replacements
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR absent_instructor_id IN (SELECT i.id FROM public.instructors i
                                           JOIN public.users u ON u.id = i.user_id
                                          WHERE i.both_branches OR u.branch_id IS NULL
                                             OR u.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS insert_instructor_replacements ON public.instructor_replacements;
CREATE POLICY insert_instructor_replacements ON public.instructor_replacements
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR absent_instructor_id IN (SELECT i.id FROM public.instructors i
                                           JOIN public.users u ON u.id = i.user_id
                                          WHERE i.both_branches OR u.branch_id IS NULL
                                             OR u.branch_id = (SELECT auth_user_branch_id()))))
  );


-- ── 9. special_service_sales (alcance: branch_id directo) ───────────────────

DROP POLICY IF EXISTS select_special_service_sales ON public.special_service_sales;
CREATE POLICY select_special_service_sales ON public.special_service_sales
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL OR branch_id = (SELECT auth_user_branch_id())))
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );

DROP POLICY IF EXISTS insert_special_service_sales ON public.special_service_sales;
CREATE POLICY insert_special_service_sales ON public.special_service_sales
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL OR branch_id = (SELECT auth_user_branch_id())))
  );

DROP POLICY IF EXISTS update_special_service_sales ON public.special_service_sales;
CREATE POLICY update_special_service_sales ON public.special_service_sales
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL OR branch_id = (SELECT auth_user_branch_id())))
  );

DROP POLICY IF EXISTS delete_special_service_sales ON public.special_service_sales;
CREATE POLICY delete_special_service_sales ON public.special_service_sales
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL OR branch_id = (SELECT auth_user_branch_id())))
  );


-- ── 10. standalone_courses (branch_id directo) + standalone_course_enrollments (vía curso) ──

DROP POLICY IF EXISTS select_standalone_courses ON public.standalone_courses;
CREATE POLICY select_standalone_courses ON public.standalone_courses
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL OR branch_id = (SELECT auth_user_branch_id())))
  );

DROP POLICY IF EXISTS insert_standalone_courses ON public.standalone_courses;
CREATE POLICY insert_standalone_courses ON public.standalone_courses
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL OR branch_id = (SELECT auth_user_branch_id())))
  );

DROP POLICY IF EXISTS update_standalone_courses ON public.standalone_courses;
CREATE POLICY update_standalone_courses ON public.standalone_courses
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL OR branch_id = (SELECT auth_user_branch_id())))
  );

DROP POLICY IF EXISTS delete_standalone_courses ON public.standalone_courses;
CREATE POLICY delete_standalone_courses ON public.standalone_courses
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL OR branch_id = (SELECT auth_user_branch_id())))
  );

DROP POLICY IF EXISTS select_standalone_course_enrollments ON public.standalone_course_enrollments;
CREATE POLICY select_standalone_course_enrollments ON public.standalone_course_enrollments
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR standalone_course_id IN (SELECT c.id FROM public.standalone_courses c
                                          WHERE c.branch_id IS NULL OR c.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS insert_standalone_course_enrollments ON public.standalone_course_enrollments;
CREATE POLICY insert_standalone_course_enrollments ON public.standalone_course_enrollments
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR standalone_course_id IN (SELECT c.id FROM public.standalone_courses c
                                          WHERE c.branch_id IS NULL OR c.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS update_standalone_course_enrollments ON public.standalone_course_enrollments;
CREATE POLICY update_standalone_course_enrollments ON public.standalone_course_enrollments
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR standalone_course_id IN (SELECT c.id FROM public.standalone_courses c
                                          WHERE c.branch_id IS NULL OR c.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS delete_standalone_course_enrollments ON public.standalone_course_enrollments;
CREATE POLICY delete_standalone_course_enrollments ON public.standalone_course_enrollments
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR standalone_course_id IN (SELECT c.id FROM public.standalone_courses c
                                          WHERE c.branch_id IS NULL OR c.branch_id = (SELECT auth_user_branch_id()))))
  );


-- ── 11. student_documents (solo INSERT; SELECT/UPDATE/DELETE ya filtraban por sede) ──

DROP POLICY IF EXISTS insert_student_documents ON public.student_documents;
CREATE POLICY insert_student_documents ON public.student_documents
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
    OR (auth_user_role() = 'student'
        AND enrollment_id IN (SELECT enrollments.id FROM enrollments
                               WHERE enrollments.student_id = auth_student_id()))
  );


-- ── 12. school_documents (UPDATE/DELETE ya eran solo admin) ─────────────────

DROP POLICY IF EXISTS select_school_documents ON public.school_documents;
CREATE POLICY select_school_documents ON public.school_documents
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL OR branch_id = (SELECT auth_user_branch_id())))
  );

DROP POLICY IF EXISTS insert_school_documents ON public.school_documents;
CREATE POLICY insert_school_documents ON public.school_documents
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL OR branch_id = (SELECT auth_user_branch_id())))
  );


-- ── 13. digital_contracts (SELECT/DELETE ya filtraban por sede) ─────────────

DROP POLICY IF EXISTS insert_digital_contracts ON public.digital_contracts;
CREATE POLICY insert_digital_contracts ON public.digital_contracts
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS update_digital_contracts ON public.digital_contracts;
CREATE POLICY update_digital_contracts ON public.digital_contracts
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))))
  );


-- ── 14. certificates + certificate_issuance_log (escrituras restantes ya eran admin) ──
-- Con matrícula → sede de la matrícula. Sin matrícula (cursos singulares) → sede del alumno.

DROP POLICY IF EXISTS select_certificates ON public.certificates;
CREATE POLICY select_certificates ON public.certificates
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))
             OR (enrollment_id IS NULL
                 AND student_id IN (SELECT s.id FROM public.students s
                                      JOIN public.users u ON u.id = s.user_id
                                     WHERE u.branch_id = (SELECT auth_user_branch_id())))))
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );

DROP POLICY IF EXISTS insert_certificates ON public.certificates;
CREATE POLICY insert_certificates ON public.certificates
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id IS NULL OR e.branch_id = (SELECT auth_user_branch_id()))
             OR (enrollment_id IS NULL
                 AND student_id IN (SELECT s.id FROM public.students s
                                      JOIN public.users u ON u.id = s.user_id
                                     WHERE u.branch_id = (SELECT auth_user_branch_id())))))
  );

-- La bitácora hereda la visibilidad del certificado (la subconsulta corre con la RLS de certificates).
DROP POLICY IF EXISTS select_certificate_issuance_log ON public.certificate_issuance_log;
CREATE POLICY select_certificate_issuance_log ON public.certificate_issuance_log
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND certificate_id IN (SELECT c.id FROM public.certificates c))
  );
