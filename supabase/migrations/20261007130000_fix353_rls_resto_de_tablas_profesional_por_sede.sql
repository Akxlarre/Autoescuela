-- ============================================================================
-- fix-353-m: RLS del resto de las tablas de Clase Profesional — aislamiento por sede
-- ============================================================================
-- Contexto (confirmado contra la BD de desarrollo el 2026-10-07, fix-319-m bloque 5): fix-321-m
-- (20261005130000) puso sede en professional_promotions, promotion_courses, class_book y en la
-- escritura de promotion_course_lecturers. El resto conservaba la cláusula de solo rol: una
-- secretaria de la sede 1 (sin Clase Profesional) leía 1.480 sesiones teóricas, 1.480 prácticas,
-- 7 relatores, 26 asignaciones de relator, 5 pre-inscripciones, 1 convalidación y 1 firma semanal
-- de la sede 2, y su UPDATE afectaba filas en las sesiones, lecturers y license_validations.
--
-- Decisión D25 (Matías, 2026-10-07): los relatores son siempre de Clase Profesional → los ve solo
-- quien tiene acceso a una sede con has_professional.
--
-- Patrón (igual que 20261005130000 y 20261001150000, ver DG-098):
--   auth_user_role() = 'admin'
--   OR (auth_user_role() = 'secretary' AND <alcance por sede>)
--   OR <cláusulas de alumno / instructor vigentes, sin cambios>
-- <alcance por sede>, evaluado una vez por query con (SELECT auth_can_access_both_branches()) y
-- (SELECT auth_user_branch_id()):
--   A. por curso      → <fk> IN (cursos cuya promoción es de la sede o no tiene sede)
--   B. por matrícula  → <fk> IN (matrículas de la sede)
--   C. por branch_id  → branch_id IS NULL OR branch_id = sede
--   D. lecturers      → la sede de la secretaria tiene has_professional
--
-- Qué NO cambia: lo que puede hacer cada rol (la secretaria sigue con el mismo CRUD, ahora solo
-- en su sede), las cláusulas de alumno e instructor, lecturer_monthly_hours (solo admin),
-- absence_evidence (ya por sede desde 20261001150000) y el DELETE de promotion_course_lecturers.
-- Las escrituras de pg_cron y de las edge functions usan la service key y no pasan por RLS.
--
-- Rollback: recrear las policies con la cláusula de rol original de
-- 20260301000011_10_rls_policies.sql (243-250, 473-480, 533-559, 586-661),
-- 20260404120000 (select de asistencia), 20260325100000 (select_promotion_course_lecturers) y
-- 20260403100000 (secretary_crud_weekly_signatures).
--
-- Idempotente: DROP POLICY IF EXISTS + CREATE POLICY. Sin funciones nuevas.
-- ============================================================================


-- ── 1. professional_theory_sessions (A: por curso) ──────────────────────────

DROP POLICY IF EXISTS select_prof_theory_sessions ON public.professional_theory_sessions;
CREATE POLICY select_prof_theory_sessions ON public.professional_theory_sessions
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR promotion_course_id IN (
                  SELECT pc.id FROM public.promotion_courses pc
                    JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                   WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT auth_user_branch_id()))))
    OR auth_user_role() = 'student'
  );

DROP POLICY IF EXISTS insert_prof_theory_sessions ON public.professional_theory_sessions;
CREATE POLICY insert_prof_theory_sessions ON public.professional_theory_sessions
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR promotion_course_id IN (
                  SELECT pc.id FROM public.promotion_courses pc
                    JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                   WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS update_prof_theory_sessions ON public.professional_theory_sessions;
CREATE POLICY update_prof_theory_sessions ON public.professional_theory_sessions
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR promotion_course_id IN (
                  SELECT pc.id FROM public.promotion_courses pc
                    JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                   WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS delete_prof_theory_sessions ON public.professional_theory_sessions;
CREATE POLICY delete_prof_theory_sessions ON public.professional_theory_sessions
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR promotion_course_id IN (
                  SELECT pc.id FROM public.promotion_courses pc
                    JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                   WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT auth_user_branch_id()))))
  );


-- ── 2. professional_practice_sessions (A: por curso) ────────────────────────

DROP POLICY IF EXISTS select_prof_practice_sessions ON public.professional_practice_sessions;
CREATE POLICY select_prof_practice_sessions ON public.professional_practice_sessions
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR promotion_course_id IN (
                  SELECT pc.id FROM public.promotion_courses pc
                    JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                   WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT auth_user_branch_id()))))
    OR (auth_user_role() = 'student'
        AND promotion_course_id IN (
          SELECT promotion_course_id FROM public.enrollments
           WHERE student_id = auth_student_id() AND promotion_course_id IS NOT NULL))
  );

DROP POLICY IF EXISTS insert_prof_practice_sessions ON public.professional_practice_sessions;
CREATE POLICY insert_prof_practice_sessions ON public.professional_practice_sessions
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR promotion_course_id IN (
                  SELECT pc.id FROM public.promotion_courses pc
                    JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                   WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS update_prof_practice_sessions ON public.professional_practice_sessions;
CREATE POLICY update_prof_practice_sessions ON public.professional_practice_sessions
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR promotion_course_id IN (
                  SELECT pc.id FROM public.promotion_courses pc
                    JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                   WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS delete_prof_practice_sessions ON public.professional_practice_sessions;
CREATE POLICY delete_prof_practice_sessions ON public.professional_practice_sessions
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR promotion_course_id IN (
                  SELECT pc.id FROM public.promotion_courses pc
                    JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                   WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT auth_user_branch_id()))))
  );


-- ── 3. session_machinery (A: por curso de su sesión práctica) ───────────────

DROP POLICY IF EXISTS select_session_machinery ON public.session_machinery;
CREATE POLICY select_session_machinery ON public.session_machinery
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR session_id IN (
                  SELECT ps.id FROM public.professional_practice_sessions ps
                    JOIN public.promotion_courses pc ON pc.id = ps.promotion_course_id
                    JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                   WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS insert_session_machinery ON public.session_machinery;
CREATE POLICY insert_session_machinery ON public.session_machinery
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR session_id IN (
                  SELECT ps.id FROM public.professional_practice_sessions ps
                    JOIN public.promotion_courses pc ON pc.id = ps.promotion_course_id
                    JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                   WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS update_session_machinery ON public.session_machinery;
CREATE POLICY update_session_machinery ON public.session_machinery
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR session_id IN (
                  SELECT ps.id FROM public.professional_practice_sessions ps
                    JOIN public.promotion_courses pc ON pc.id = ps.promotion_course_id
                    JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                   WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS delete_session_machinery ON public.session_machinery;
CREATE POLICY delete_session_machinery ON public.session_machinery
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR session_id IN (
                  SELECT ps.id FROM public.professional_practice_sessions ps
                    JOIN public.promotion_courses pc ON pc.id = ps.promotion_course_id
                    JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                   WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT auth_user_branch_id()))))
  );


-- ── 4. professional_weekly_signatures (A: por curso) ────────────────────────
-- Solo cambia la policy de la secretaria; las de admin, instructor y alumno quedan igual.

DROP POLICY IF EXISTS "secretary_crud_weekly_signatures" ON public.professional_weekly_signatures;
CREATE POLICY "secretary_crud_weekly_signatures" ON public.professional_weekly_signatures
  FOR ALL TO authenticated
  USING (
    auth_user_role() = 'secretary'
    AND ((SELECT auth_can_access_both_branches())
         OR promotion_course_id IN (
              SELECT pc.id FROM public.promotion_courses pc
                JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
               WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT auth_user_branch_id())))
  )
  WITH CHECK (
    auth_user_role() = 'secretary'
    AND ((SELECT auth_can_access_both_branches())
         OR promotion_course_id IN (
              SELECT pc.id FROM public.promotion_courses pc
                JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
               WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT auth_user_branch_id())))
  );


-- ── 5. promotion_course_lecturers — lectura (A: por curso) ──────────────────
-- Antes la lectura no tenía ninguna condición. Solo se acota a la secretaria; los demás roles
-- leen igual que antes.

DROP POLICY IF EXISTS select_promotion_course_lecturers ON public.promotion_course_lecturers;
CREATE POLICY select_promotion_course_lecturers ON public.promotion_course_lecturers
  FOR SELECT USING (
    auth_user_role() IS DISTINCT FROM 'secretary'
    OR (SELECT auth_can_access_both_branches())
    OR promotion_course_id IN (
         SELECT pc.id FROM public.promotion_courses pc
           JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
          WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT auth_user_branch_id()))
  );


-- ── 6. professional_theory_attendance (B: por matrícula) ────────────────────

DROP POLICY IF EXISTS select_prof_theory_attendance ON public.professional_theory_attendance;
CREATE POLICY select_prof_theory_attendance ON public.professional_theory_attendance
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
    OR (auth_user_role() = 'student'
        AND EXISTS (SELECT 1 FROM public.enrollments e
                     WHERE e.id = enrollment_id AND e.student_id = auth_student_id()))
  );

DROP POLICY IF EXISTS insert_prof_theory_attendance ON public.professional_theory_attendance;
CREATE POLICY insert_prof_theory_attendance ON public.professional_theory_attendance
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS update_prof_theory_attendance ON public.professional_theory_attendance;
CREATE POLICY update_prof_theory_attendance ON public.professional_theory_attendance
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS delete_prof_theory_attendance ON public.professional_theory_attendance;
CREATE POLICY delete_prof_theory_attendance ON public.professional_theory_attendance
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
  );


-- ── 7. professional_practice_attendance (B: por matrícula) ──────────────────

DROP POLICY IF EXISTS select_prof_practice_attendance ON public.professional_practice_attendance;
CREATE POLICY select_prof_practice_attendance ON public.professional_practice_attendance
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
    OR (auth_user_role() = 'student'
        AND EXISTS (SELECT 1 FROM public.enrollments e
                     WHERE e.id = enrollment_id AND e.student_id = auth_student_id()))
  );

DROP POLICY IF EXISTS insert_prof_practice_attendance ON public.professional_practice_attendance;
CREATE POLICY insert_prof_practice_attendance ON public.professional_practice_attendance
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS update_prof_practice_attendance ON public.professional_practice_attendance;
CREATE POLICY update_prof_practice_attendance ON public.professional_practice_attendance
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS delete_prof_practice_attendance ON public.professional_practice_attendance;
CREATE POLICY delete_prof_practice_attendance ON public.professional_practice_attendance
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
  );


-- ── 8. professional_module_grades (B: por matrícula) ────────────────────────

DROP POLICY IF EXISTS select_prof_module_grades ON public.professional_module_grades;
CREATE POLICY select_prof_module_grades ON public.professional_module_grades
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
    OR (auth_user_role() = 'student'
        AND enrollment_id IN (SELECT id FROM public.enrollments
                               WHERE student_id = auth_student_id()))
  );

DROP POLICY IF EXISTS insert_prof_module_grades ON public.professional_module_grades;
CREATE POLICY insert_prof_module_grades ON public.professional_module_grades
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS update_prof_module_grades ON public.professional_module_grades;
CREATE POLICY update_prof_module_grades ON public.professional_module_grades
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS delete_prof_module_grades ON public.professional_module_grades;
CREATE POLICY delete_prof_module_grades ON public.professional_module_grades
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
  );


-- ── 9. professional_final_records (B: por matrícula) ────────────────────────

DROP POLICY IF EXISTS select_prof_final_records ON public.professional_final_records;
CREATE POLICY select_prof_final_records ON public.professional_final_records
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
    OR (auth_user_role() = 'student'
        AND enrollment_id IN (SELECT id FROM public.enrollments
                               WHERE student_id = auth_student_id()))
  );

DROP POLICY IF EXISTS insert_prof_final_records ON public.professional_final_records;
CREATE POLICY insert_prof_final_records ON public.professional_final_records
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS update_prof_final_records ON public.professional_final_records;
CREATE POLICY update_prof_final_records ON public.professional_final_records
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS delete_prof_final_records ON public.professional_final_records;
CREATE POLICY delete_prof_final_records ON public.professional_final_records
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
  );


-- ── 10. license_validations (B: por matrícula) ──────────────────────────────
-- enrollment_id es nullable: una fila sin matrícula sigue visible (NULL = visible, como
-- branch_visible()). La matrícula escribe la fila con el enrollment_id del borrador (upsert).

DROP POLICY IF EXISTS select_license_validations ON public.license_validations;
CREATE POLICY select_license_validations ON public.license_validations
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IS NULL
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS insert_license_validations ON public.license_validations;
CREATE POLICY insert_license_validations ON public.license_validations
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IS NULL
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS update_license_validations ON public.license_validations;
CREATE POLICY update_license_validations ON public.license_validations
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IS NULL
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS delete_license_validations ON public.license_validations;
CREATE POLICY delete_license_validations ON public.license_validations
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR enrollment_id IS NULL
             OR enrollment_id IN (SELECT e.id FROM public.enrollments e
                                   WHERE e.branch_id = (SELECT auth_user_branch_id()))))
  );


-- ── 11. professional_pre_registrations (C: por branch_id) ───────────────────

DROP POLICY IF EXISTS select_pre_registrations ON public.professional_pre_registrations;
CREATE POLICY select_pre_registrations ON public.professional_pre_registrations
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL
             OR branch_id = (SELECT auth_user_branch_id())))
  );

DROP POLICY IF EXISTS insert_pre_registrations ON public.professional_pre_registrations;
CREATE POLICY insert_pre_registrations ON public.professional_pre_registrations
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL
             OR branch_id = (SELECT auth_user_branch_id())))
  );

DROP POLICY IF EXISTS update_pre_registrations ON public.professional_pre_registrations;
CREATE POLICY update_pre_registrations ON public.professional_pre_registrations
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL
             OR branch_id = (SELECT auth_user_branch_id())))
  );

DROP POLICY IF EXISTS delete_pre_registrations ON public.professional_pre_registrations;
CREATE POLICY delete_pre_registrations ON public.professional_pre_registrations
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL
             OR branch_id = (SELECT auth_user_branch_id())))
  );


-- ── 12. lecturers (D: sede con Clase Profesional — D25) ─────────────────────
-- lecturers no tiene sede: los relatores son siempre de Clase Profesional.

DROP POLICY IF EXISTS select_lecturers ON public.lecturers;
CREATE POLICY select_lecturers ON public.lecturers
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR EXISTS (SELECT 1 FROM public.branches b
                         WHERE b.id = (SELECT auth_user_branch_id()) AND b.has_professional)))
  );

DROP POLICY IF EXISTS insert_lecturers ON public.lecturers;
CREATE POLICY insert_lecturers ON public.lecturers
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR EXISTS (SELECT 1 FROM public.branches b
                         WHERE b.id = (SELECT auth_user_branch_id()) AND b.has_professional)))
  );

DROP POLICY IF EXISTS update_lecturers ON public.lecturers;
CREATE POLICY update_lecturers ON public.lecturers
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR EXISTS (SELECT 1 FROM public.branches b
                         WHERE b.id = (SELECT auth_user_branch_id()) AND b.has_professional)))
  );

DROP POLICY IF EXISTS delete_lecturers ON public.lecturers;
CREATE POLICY delete_lecturers ON public.lecturers
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR EXISTS (SELECT 1 FROM public.branches b
                         WHERE b.id = (SELECT auth_user_branch_id()) AND b.has_professional)))
  );
