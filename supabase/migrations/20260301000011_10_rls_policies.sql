-- ============================================================================
-- 10 — Políticas RLS (Row Level Security)
-- ============================================================================
-- Ejecutar DESPUÉS de 09_enable_rls.sql.
-- Requiere que auth.uid() esté disponible (Supabase lo provee automáticamente).
--
-- IMPORTANTE: Cada tabla tiene exactamente UNA política por operación (SELECT,
-- INSERT, UPDATE, DELETE) para evitar el warning "Multiple Permissive Policies"
-- de Supabase. Las condiciones de múltiples roles se consolidan con OR.
--
-- Para tablas con acceso exclusivo de admin se usa FOR ALL (una sola política).
--
-- Roles de aplicación: admin, secretary, instructor, student
-- ============================================================================


-- ############################################################################
-- PARTE A: FUNCIONES HELPER (SECURITY DEFINER, STABLE)
-- ############################################################################
-- Estas funciones resuelven datos del usuario autenticado una sola vez por query.
-- SECURITY DEFINER permite que se ejecuten con permisos elevados para leer users/roles.

CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS INT AS $$
  SELECT id FROM public.users WHERE supabase_uid = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT AS $$
  SELECT r.name FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE u.supabase_uid = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION auth_user_branch_id()
RETURNS INT AS $$
  SELECT branch_id FROM public.users WHERE supabase_uid = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION auth_can_access_both_branches()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(can_access_both_branches, false) FROM public.users WHERE supabase_uid = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION auth_student_id()
RETURNS INT AS $$
  SELECT s.id FROM public.students s
  JOIN public.users u ON u.id = s.user_id
  WHERE u.supabase_uid = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION auth_instructor_id()
RETURNS INT AS $$
  SELECT i.id FROM public.instructors i
  JOIN public.users u ON u.id = i.user_id
  WHERE u.supabase_uid = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- Helper: ¿el registro pertenece a la sede del usuario (o tiene acceso a ambas)?
-- Uso: branch_visible(some_table.branch_id)
CREATE OR REPLACE FUNCTION branch_visible(p_branch_id INT)
RETURNS BOOLEAN AS $$
  SELECT p_branch_id IS NULL
      OR public.auth_can_access_both_branches()
      OR p_branch_id = public.auth_user_branch_id()
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';


-- ############################################################################
-- LIMPIEZA: Eliminar todas las políticas previas para recrear consolidadas
-- ############################################################################
DO $$ DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;


-- ############################################################################
-- PARTE B: POLÍTICAS POR TABLA (una política por operación)
-- ############################################################################
-- Organizado por módulo, siguiendo la tabla §5.1 del análisis.
-- Notación en comentarios: C=Create, R=Read, U=Update, D=Delete


-- ============================================================================
-- MÓDULO 1 — Usuarios, Roles y Sedes
-- ============================================================================

-- ---------- branches ----------
-- Lectura: todos los autenticados | Escritura: admin
CREATE POLICY select_branches ON branches
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY insert_branches ON branches
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_branches ON branches
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_branches ON branches
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- roles ----------
-- Lectura: todos los autenticados | Escritura: admin
CREATE POLICY select_roles ON roles
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY insert_roles ON roles
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_roles ON roles
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_roles ON roles
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- users ----------
-- Admin: CRUD | Secretary: R (excluye admins) | Instructor/Student: R (sí mismo)
CREATE POLICY select_users ON users
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND (role_id IS NULL OR role_id != (SELECT id FROM roles WHERE name = 'admin')))
    OR (auth_user_role() IN ('instructor', 'student') AND id = auth_user_id())
  );
CREATE POLICY insert_users ON users
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_users ON users
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_users ON users
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- login_attempts ----------
-- Solo admin (tabla única política → FOR ALL)
CREATE POLICY all_login_attempts ON login_attempts
  FOR ALL USING (auth_user_role() = 'admin');

-- ---------- students ----------
-- Admin/Secretary: CRUD | Instructor: R (asignados) | Student: R (sí mismo)
CREATE POLICY select_students ON students
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'instructor'
        AND id IN (
          SELECT e.student_id FROM class_b_sessions cb
          JOIN enrollments e ON e.id = cb.enrollment_id
          WHERE cb.instructor_id = auth_instructor_id()
            AND cb.status NOT IN ('cancelled')
        ))
    OR (auth_user_role() = 'student' AND id = auth_student_id())
  );
CREATE POLICY insert_students ON students
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_students ON students
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY delete_students ON students
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- courses ----------
-- Lectura: todos los autenticados | Escritura: admin
CREATE POLICY select_courses ON courses
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY insert_courses ON courses
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_courses ON courses
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_courses ON courses
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- sence_codes ----------
-- Admin: CRUD | Secretary: R
CREATE POLICY select_sence_codes ON sence_codes
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_sence_codes ON sence_codes
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_sence_codes ON sence_codes
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_sence_codes ON sence_codes
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- audit_log ----------
-- Solo admin lectura (RF-010). Sin INSERT/UPDATE/DELETE (solo triggers escriben)
CREATE POLICY select_audit_log ON audit_log
  FOR SELECT USING (auth_user_role() = 'admin');

-- ---------- school_schedules ----------
-- Lectura: todos los autenticados | Escritura: admin
CREATE POLICY select_school_schedules ON school_schedules
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY insert_school_schedules ON school_schedules
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_school_schedules ON school_schedules
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_school_schedules ON school_schedules
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- secretary_observations ----------
-- Admin: CRUD | Secretary: CR (solo crea propias y lee)
CREATE POLICY select_secretary_observations ON secretary_observations
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_secretary_observations ON secretary_observations
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND created_by = auth_user_id())
  );
CREATE POLICY update_secretary_observations ON secretary_observations
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_secretary_observations ON secretary_observations
  FOR DELETE USING (auth_user_role() = 'admin');


-- ============================================================================
-- MÓDULO 2 — Matrículas y Descuentos
-- ============================================================================

-- ---------- enrollments ----------
-- Admin: CRUD | Secretary: CRUD (sede) | Instructor: R | Student: R (propias)
CREATE POLICY select_enrollments ON enrollments
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
    OR auth_user_role() = 'instructor'
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );
CREATE POLICY insert_enrollments ON enrollments
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
  );
CREATE POLICY update_enrollments ON enrollments
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
  );
CREATE POLICY delete_enrollments ON enrollments
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
  );

-- ---------- professional_pre_registrations ----------
-- Admin/Secretary: CRUD
CREATE POLICY select_pre_registrations ON professional_pre_registrations
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_pre_registrations ON professional_pre_registrations
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_pre_registrations ON professional_pre_registrations
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY delete_pre_registrations ON professional_pre_registrations
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- discounts ----------
-- Admin: CRUD | Secretary: R
CREATE POLICY select_discounts ON discounts
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_discounts ON discounts
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_discounts ON discounts
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_discounts ON discounts
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- discount_applications ----------
-- Admin: CRUD | Secretary: CR
CREATE POLICY select_discount_applications ON discount_applications
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_discount_applications ON discount_applications
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_discount_applications ON discount_applications
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_discount_applications ON discount_applications
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- pricing_seasons ----------
-- Solo admin (tabla única política → FOR ALL)
CREATE POLICY all_pricing_seasons ON pricing_seasons
  FOR ALL USING (auth_user_role() = 'admin');


-- ============================================================================
-- MÓDULO 3 — Gestión Académica Clase B
-- ============================================================================

-- ---------- instructors ----------
-- Admin: CRUD | Secretary: R | Instructor: R (sí mismo) | Student: R (instructor asignado)
CREATE POLICY select_instructors ON instructors
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'instructor' AND id = auth_instructor_id())
    OR (auth_user_role() = 'student'
        AND id IN (
          SELECT cb.instructor_id FROM class_b_sessions cb
          JOIN enrollments e ON e.id = cb.enrollment_id
          WHERE e.student_id = auth_student_id()
            AND cb.status NOT IN ('cancelled')
        ))
  );
CREATE POLICY insert_instructors ON instructors
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_instructors ON instructors
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_instructors ON instructors
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- vehicle_assignments ----------
-- Admin: CRUD | Secretary: R | Instructor: R (propias)
CREATE POLICY select_vehicle_assignments ON vehicle_assignments
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'instructor' AND instructor_id = auth_instructor_id())
  );
CREATE POLICY insert_vehicle_assignments ON vehicle_assignments
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_vehicle_assignments ON vehicle_assignments
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_vehicle_assignments ON vehicle_assignments
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- instructor_replacements ----------
-- Admin: CRUD | Secretary: CR
CREATE POLICY select_instructor_replacements ON instructor_replacements
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_instructor_replacements ON instructor_replacements
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_instructor_replacements ON instructor_replacements
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_instructor_replacements ON instructor_replacements
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- instructor_monthly_hours ----------
-- Admin: CRUD | Instructor: R (sí mismo)
CREATE POLICY select_instructor_monthly_hours ON instructor_monthly_hours
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'instructor' AND instructor_id = auth_instructor_id())
  );
CREATE POLICY insert_instructor_monthly_hours ON instructor_monthly_hours
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_instructor_monthly_hours ON instructor_monthly_hours
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_instructor_monthly_hours ON instructor_monthly_hours
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- class_b_sessions ----------
-- Admin/Secretary: CRUD | Instructor: CRU (propias) | Student: R (propias)
CREATE POLICY select_class_b_sessions ON class_b_sessions
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'instructor' AND instructor_id = auth_instructor_id())
    OR (auth_user_role() = 'student'
        AND enrollment_id IN (SELECT id FROM enrollments WHERE student_id = auth_student_id()))
  );
CREATE POLICY insert_class_b_sessions ON class_b_sessions
  FOR INSERT WITH CHECK (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'instructor' AND instructor_id = auth_instructor_id())
  );
CREATE POLICY update_class_b_sessions ON class_b_sessions
  FOR UPDATE USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'instructor' AND instructor_id = auth_instructor_id())
  );
CREATE POLICY delete_class_b_sessions ON class_b_sessions
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- class_b_theory_sessions ----------
-- Admin/Secretary: CRUD | Instructor: CRU | Student: R
CREATE POLICY select_class_b_theory_sessions ON class_b_theory_sessions
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary', 'instructor', 'student'));
CREATE POLICY insert_class_b_theory_sessions ON class_b_theory_sessions
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary', 'instructor'));
CREATE POLICY update_class_b_theory_sessions ON class_b_theory_sessions
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary', 'instructor'));
CREATE POLICY delete_class_b_theory_sessions ON class_b_theory_sessions
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- class_b_theory_attendance ----------
-- Admin/Secretary: CRUD | Instructor: CRU | Student: R (propias)
CREATE POLICY select_class_b_theory_attendance ON class_b_theory_attendance
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary', 'instructor')
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );
CREATE POLICY insert_class_b_theory_attendance ON class_b_theory_attendance
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary', 'instructor'));
CREATE POLICY update_class_b_theory_attendance ON class_b_theory_attendance
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary', 'instructor'));
CREATE POLICY delete_class_b_theory_attendance ON class_b_theory_attendance
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- class_b_practice_attendance ----------
-- Admin/Secretary: CRUD | Instructor: CRU | Student: R (propias)
CREATE POLICY select_class_b_practice_attendance ON class_b_practice_attendance
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary', 'instructor')
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );
CREATE POLICY insert_class_b_practice_attendance ON class_b_practice_attendance
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary', 'instructor'));
CREATE POLICY update_class_b_practice_attendance ON class_b_practice_attendance
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary', 'instructor'));
CREATE POLICY delete_class_b_practice_attendance ON class_b_practice_attendance
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- class_b_exam_catalog ----------
-- Admin: CRUD | Secretary/Student: R
CREATE POLICY select_class_b_exam_catalog ON class_b_exam_catalog
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary', 'student'));
CREATE POLICY insert_class_b_exam_catalog ON class_b_exam_catalog
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_class_b_exam_catalog ON class_b_exam_catalog
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_class_b_exam_catalog ON class_b_exam_catalog
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- class_b_exam_questions ----------
-- Admin: CRUD | Secretary: R | Student: R (solo con intento activo sin submitted_at)
CREATE POLICY select_class_b_exam_questions ON class_b_exam_questions
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'student'
        AND exam_id IN (
          SELECT exam_id FROM class_b_exam_attempts
          WHERE student_id = auth_student_id()
            AND submitted_at IS NULL
        ))
  );
CREATE POLICY insert_class_b_exam_questions ON class_b_exam_questions
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_class_b_exam_questions ON class_b_exam_questions
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_class_b_exam_questions ON class_b_exam_questions
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- class_b_exam_attempts ----------
-- Admin: CRUD | Secretary: R | Student: CR (propios)
CREATE POLICY select_class_b_exam_attempts ON class_b_exam_attempts
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );
CREATE POLICY insert_class_b_exam_attempts ON class_b_exam_attempts
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );
CREATE POLICY update_class_b_exam_attempts ON class_b_exam_attempts
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_class_b_exam_attempts ON class_b_exam_attempts
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- class_b_exam_scores ----------
-- Admin: CRUD | Secretary: CR | Instructor: CRU | Student: R (propios)
CREATE POLICY select_class_b_exam_scores ON class_b_exam_scores
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary', 'instructor')
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );
CREATE POLICY insert_class_b_exam_scores ON class_b_exam_scores
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary', 'instructor'));
CREATE POLICY update_class_b_exam_scores ON class_b_exam_scores
  FOR UPDATE USING (auth_user_role() IN ('admin', 'instructor'));
CREATE POLICY delete_class_b_exam_scores ON class_b_exam_scores
  FOR DELETE USING (auth_user_role() = 'admin');


-- ============================================================================
-- MÓDULO 4 — Gestión Académica Profesional
-- ============================================================================

-- ---------- lecturers ----------
-- Admin/Secretary: CRUD
CREATE POLICY select_lecturers ON lecturers
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_lecturers ON lecturers
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_lecturers ON lecturers
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY delete_lecturers ON lecturers
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- lecturer_monthly_hours ----------
-- Solo admin (tabla única política → FOR ALL)
CREATE POLICY all_lecturer_monthly_hours ON lecturer_monthly_hours
  FOR ALL USING (auth_user_role() = 'admin');

-- ---------- professional_promotions ----------
-- Admin/Secretary: CRUD | Student: R
CREATE POLICY select_professional_promotions ON professional_promotions
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary', 'student'));
CREATE POLICY insert_professional_promotions ON professional_promotions
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_professional_promotions ON professional_promotions
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY delete_professional_promotions ON professional_promotions
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- professional_schedule_templates ----------
-- Admin: CRUD | Secretary: R
CREATE POLICY select_schedule_templates ON professional_schedule_templates
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_schedule_templates ON professional_schedule_templates
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_schedule_templates ON professional_schedule_templates
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_schedule_templates ON professional_schedule_templates
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- template_blocks ----------
-- Admin: CRUD | Secretary: R
CREATE POLICY select_template_blocks ON template_blocks
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_template_blocks ON template_blocks
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_template_blocks ON template_blocks
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_template_blocks ON template_blocks
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- promotion_courses ----------
-- Admin/Secretary: CRUD | Student: R
CREATE POLICY select_promotion_courses ON promotion_courses
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary', 'student'));
CREATE POLICY insert_promotion_courses ON promotion_courses
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_promotion_courses ON promotion_courses
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY delete_promotion_courses ON promotion_courses
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- professional_theory_sessions ----------
-- Admin/Secretary: CRUD | Student: R
CREATE POLICY select_prof_theory_sessions ON professional_theory_sessions
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary', 'student'));
CREATE POLICY insert_prof_theory_sessions ON professional_theory_sessions
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_prof_theory_sessions ON professional_theory_sessions
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY delete_prof_theory_sessions ON professional_theory_sessions
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- professional_practice_sessions ----------
-- Admin/Secretary: CRUD | Student: R (propias por promoción)
CREATE POLICY select_prof_practice_sessions ON professional_practice_sessions
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'student'
        AND promotion_course_id IN (
          SELECT promotion_course_id FROM enrollments
          WHERE student_id = auth_student_id()
            AND promotion_course_id IS NOT NULL
        ))
  );
CREATE POLICY insert_prof_practice_sessions ON professional_practice_sessions
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_prof_practice_sessions ON professional_practice_sessions
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY delete_prof_practice_sessions ON professional_practice_sessions
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- absence_evidence ----------
-- Admin/Secretary: CRUD | Student: CRU (propias)
CREATE POLICY select_absence_evidence ON absence_evidence
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'student'
        AND enrollment_id IN (SELECT id FROM enrollments WHERE student_id = auth_student_id()))
  );
CREATE POLICY insert_absence_evidence ON absence_evidence
  FOR INSERT WITH CHECK (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'student'
        AND enrollment_id IN (SELECT id FROM enrollments WHERE student_id = auth_student_id()))
  );
CREATE POLICY update_absence_evidence ON absence_evidence
  FOR UPDATE USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'student'
        AND enrollment_id IN (SELECT id FROM enrollments WHERE student_id = auth_student_id()))
  );
CREATE POLICY delete_absence_evidence ON absence_evidence
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- professional_theory_attendance ----------
-- Admin/Secretary: CRUD | Student: R (propias)
CREATE POLICY select_prof_theory_attendance ON professional_theory_attendance
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );
CREATE POLICY insert_prof_theory_attendance ON professional_theory_attendance
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_prof_theory_attendance ON professional_theory_attendance
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY delete_prof_theory_attendance ON professional_theory_attendance
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- professional_practice_attendance ----------
-- Admin/Secretary: CRUD | Student: R (propias)
CREATE POLICY select_prof_practice_attendance ON professional_practice_attendance
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );
CREATE POLICY insert_prof_practice_attendance ON professional_practice_attendance
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_prof_practice_attendance ON professional_practice_attendance
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY delete_prof_practice_attendance ON professional_practice_attendance
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- professional_module_grades ----------
-- Admin/Secretary: CRUD | Student: R (propias)
CREATE POLICY select_prof_module_grades ON professional_module_grades
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'student'
        AND enrollment_id IN (SELECT id FROM enrollments WHERE student_id = auth_student_id()))
  );
CREATE POLICY insert_prof_module_grades ON professional_module_grades
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_prof_module_grades ON professional_module_grades
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY delete_prof_module_grades ON professional_module_grades
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- session_machinery ----------
-- Admin/Secretary: CRUD
CREATE POLICY select_session_machinery ON session_machinery
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_session_machinery ON session_machinery
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_session_machinery ON session_machinery
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY delete_session_machinery ON session_machinery
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- license_validations ----------
-- Admin/Secretary: CRUD
CREATE POLICY select_license_validations ON license_validations
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_license_validations ON license_validations
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_license_validations ON license_validations
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY delete_license_validations ON license_validations
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- professional_final_records ----------
-- Admin/Secretary: CRUD | Student: R (propias)
CREATE POLICY select_prof_final_records ON professional_final_records
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'student'
        AND enrollment_id IN (SELECT id FROM enrollments WHERE student_id = auth_student_id()))
  );
CREATE POLICY insert_prof_final_records ON professional_final_records
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_prof_final_records ON professional_final_records
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY delete_prof_final_records ON professional_final_records
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- class_book ----------
-- Admin: CRUD | Secretary: CRU (si status ≠ 'closed') | Student: R
CREATE POLICY select_class_book ON class_book
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary', 'student'));
CREATE POLICY insert_class_book ON class_book
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_class_book ON class_book
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND status != 'closed')
  );
CREATE POLICY delete_class_book ON class_book
  FOR DELETE USING (auth_user_role() = 'admin');


-- ============================================================================
-- MÓDULO 5 — Pagos y Finanzas
-- ============================================================================

-- ---------- sii_receipts ----------
-- Admin: CRUD | Secretary: CR
CREATE POLICY select_sii_receipts ON sii_receipts
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_sii_receipts ON sii_receipts
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_sii_receipts ON sii_receipts
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_sii_receipts ON sii_receipts
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- payments ----------
-- Admin/Secretary: CRUD | Student: R (propios)
CREATE POLICY select_payments ON payments
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'student'
        AND enrollment_id IN (SELECT id FROM enrollments WHERE student_id = auth_student_id()))
  );
CREATE POLICY insert_payments ON payments
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_payments ON payments
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY delete_payments ON payments
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- payment_denominations ----------
-- Admin: CRUD | Secretary: CR
CREATE POLICY select_payment_denominations ON payment_denominations
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_payment_denominations ON payment_denominations
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_payment_denominations ON payment_denominations
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_payment_denominations ON payment_denominations
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- expenses ----------
-- Admin: CRUD | Secretary: CRUD (sede)
CREATE POLICY select_expenses ON expenses
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
  );
CREATE POLICY insert_expenses ON expenses
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
  );
CREATE POLICY update_expenses ON expenses
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
  );
CREATE POLICY delete_expenses ON expenses
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
  );

-- ---------- cash_closings ----------
-- Admin: CRUD | Secretary: CR (últimos 2 días + sede, §5.1)
CREATE POLICY select_cash_closings ON cash_closings
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND date >= CURRENT_DATE - INTERVAL '2 days'
        AND branch_visible(branch_id))
  );
CREATE POLICY insert_cash_closings ON cash_closings
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
  );
CREATE POLICY update_cash_closings ON cash_closings
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_cash_closings ON cash_closings
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- instructor_advances ----------
-- Admin: CRUD | Secretary: CR | Instructor: R (propios)
CREATE POLICY select_instructor_advances ON instructor_advances
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'instructor' AND instructor_id = auth_instructor_id())
  );
CREATE POLICY insert_instructor_advances ON instructor_advances
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_instructor_advances ON instructor_advances
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_instructor_advances ON instructor_advances
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- instructor_monthly_payments ----------
-- Admin: CRUD | Instructor: R (propios)
CREATE POLICY select_instructor_monthly_payments ON instructor_monthly_payments
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'instructor' AND instructor_id = auth_instructor_id())
  );
CREATE POLICY insert_instructor_monthly_payments ON instructor_monthly_payments
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_instructor_monthly_payments ON instructor_monthly_payments
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_instructor_monthly_payments ON instructor_monthly_payments
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- service_catalog ----------
-- Lectura: todos los autenticados | Escritura: admin/secretary
CREATE POLICY select_service_catalog ON service_catalog
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY insert_service_catalog ON service_catalog
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_service_catalog ON service_catalog
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY delete_service_catalog ON service_catalog
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- special_service_sales ----------
-- Admin/Secretary: CRUD | Student: R (propias)
CREATE POLICY select_special_service_sales ON special_service_sales
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );
CREATE POLICY insert_special_service_sales ON special_service_sales
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_special_service_sales ON special_service_sales
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY delete_special_service_sales ON special_service_sales
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- standalone_courses ----------
-- Admin/Secretary: CRUD
CREATE POLICY select_standalone_courses ON standalone_courses
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_standalone_courses ON standalone_courses
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_standalone_courses ON standalone_courses
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY delete_standalone_courses ON standalone_courses
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));

-- ---------- standalone_course_enrollments ----------
-- Admin/Secretary: CRUD
CREATE POLICY select_standalone_course_enrollments ON standalone_course_enrollments
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_standalone_course_enrollments ON standalone_course_enrollments
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_standalone_course_enrollments ON standalone_course_enrollments
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY delete_standalone_course_enrollments ON standalone_course_enrollments
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));


-- ============================================================================
-- MÓDULO 6 — Documentos y DMS
-- ============================================================================

-- ---------- student_documents ----------
-- Admin: CRUD | Secretary: CR | Instructor: R | Student: CRU (propios)
CREATE POLICY select_student_documents ON student_documents
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary', 'instructor')
    OR (auth_user_role() = 'student'
        AND enrollment_id IN (SELECT id FROM enrollments WHERE student_id = auth_student_id()))
  );
CREATE POLICY insert_student_documents ON student_documents
  FOR INSERT WITH CHECK (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'student'
        AND enrollment_id IN (SELECT id FROM enrollments WHERE student_id = auth_student_id()))
  );
CREATE POLICY update_student_documents ON student_documents
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'student'
        AND enrollment_id IN (SELECT id FROM enrollments WHERE student_id = auth_student_id()))
  );
CREATE POLICY delete_student_documents ON student_documents
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- digital_contracts ----------
-- Admin: CRUD | Secretary: CR | Student: R (propios)
CREATE POLICY select_digital_contracts ON digital_contracts
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );
CREATE POLICY insert_digital_contracts ON digital_contracts
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_digital_contracts ON digital_contracts
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_digital_contracts ON digital_contracts
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- school_documents ----------
-- Admin: CRUD | Secretary: CR
CREATE POLICY select_school_documents ON school_documents
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_school_documents ON school_documents
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_school_documents ON school_documents
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_school_documents ON school_documents
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- document_templates ----------
-- Lectura: todos los autenticados | Escritura: admin
CREATE POLICY select_document_templates ON document_templates
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY insert_document_templates ON document_templates
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_document_templates ON document_templates
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_document_templates ON document_templates
  FOR DELETE USING (auth_user_role() = 'admin');


-- ============================================================================
-- MÓDULO 7 — Flota y Vehículos
-- ============================================================================

-- ---------- vehicles ----------
-- Admin: CRUD | Secretary/Instructor: R
CREATE POLICY select_vehicles ON vehicles
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary', 'instructor'));
CREATE POLICY insert_vehicles ON vehicles
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_vehicles ON vehicles
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_vehicles ON vehicles
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- vehicle_documents ----------
-- Admin: CRUD | Secretary/Instructor: R
CREATE POLICY select_vehicle_documents ON vehicle_documents
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary', 'instructor'));
CREATE POLICY insert_vehicle_documents ON vehicle_documents
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_vehicle_documents ON vehicle_documents
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_vehicle_documents ON vehicle_documents
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- maintenance_records ----------
-- Admin: CRUD | Secretary: R
CREATE POLICY select_maintenance_records ON maintenance_records
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_maintenance_records ON maintenance_records
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_maintenance_records ON maintenance_records
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_maintenance_records ON maintenance_records
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- route_incidents ----------
-- Admin: CRUD | Secretary: CR | Instructor: CR (propios)
CREATE POLICY select_route_incidents ON route_incidents
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'instructor' AND instructor_id = auth_instructor_id())
  );
CREATE POLICY insert_route_incidents ON route_incidents
  FOR INSERT WITH CHECK (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'instructor' AND instructor_id = auth_instructor_id())
  );
CREATE POLICY update_route_incidents ON route_incidents
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_route_incidents ON route_incidents
  FOR DELETE USING (auth_user_role() = 'admin');


-- ============================================================================
-- MÓDULO 8 — Certificados, Notificaciones, Biometría, Disciplina
-- ============================================================================

-- ---------- certificate_batches ----------
-- Solo admin (tabla única política → FOR ALL)
CREATE POLICY all_certificate_batches ON certificate_batches
  FOR ALL USING (auth_user_role() = 'admin');

-- ---------- certificates ----------
-- Admin: CRUD | Secretary: CR | Student: R (propios)
CREATE POLICY select_certificates ON certificates
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );
CREATE POLICY insert_certificates ON certificates
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_certificates ON certificates
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_certificates ON certificates
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- certificate_issuance_log ----------
-- Admin: CRUD | Secretary: R
CREATE POLICY select_certificate_issuance_log ON certificate_issuance_log
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_certificate_issuance_log ON certificate_issuance_log
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_certificate_issuance_log ON certificate_issuance_log
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_certificate_issuance_log ON certificate_issuance_log
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- notifications ----------
-- Admin: CRUD | Cada usuario: RU (propias)
CREATE POLICY select_notifications ON notifications
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR recipient_id = auth_user_id()
  );
CREATE POLICY insert_notifications ON notifications
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_notifications ON notifications
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR recipient_id = auth_user_id()
  );
CREATE POLICY delete_notifications ON notifications
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- notification_templates ----------
-- Admin: CRUD | Secretary: R
CREATE POLICY select_notification_templates ON notification_templates
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY insert_notification_templates ON notification_templates
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_notification_templates ON notification_templates
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_notification_templates ON notification_templates
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- alert_config ----------
-- Solo admin (tabla única política → FOR ALL)
CREATE POLICY all_alert_config ON alert_config
  FOR ALL USING (auth_user_role() = 'admin');

-- ---------- disciplinary_notes ----------
-- Admin: CRUD | Secretary: CR | Student: R (propias)
CREATE POLICY select_disciplinary_notes ON disciplinary_notes
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );
CREATE POLICY insert_disciplinary_notes ON disciplinary_notes
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
CREATE POLICY update_disciplinary_notes ON disciplinary_notes
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_disciplinary_notes ON disciplinary_notes
  FOR DELETE USING (auth_user_role() = 'admin');

-- ---------- biometric_records ----------
-- Admin: CRUD | Secretary: R | Student: R (propios)
CREATE POLICY select_biometric_records ON biometric_records
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (auth_user_role() = 'student' AND student_id = auth_student_id())
  );
CREATE POLICY insert_biometric_records ON biometric_records
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');
CREATE POLICY update_biometric_records ON biometric_records
  FOR UPDATE USING (auth_user_role() = 'admin');
CREATE POLICY delete_biometric_records ON biometric_records
  FOR DELETE USING (auth_user_role() = 'admin');
