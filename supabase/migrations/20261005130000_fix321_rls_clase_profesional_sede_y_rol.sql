-- ============================================================================
-- fix-321-m: RLS de Clase Profesional — aislamiento por sede (S6) y permisos de la secretaria (D5)
-- ============================================================================
-- Contexto (confirmado contra la BD de desarrollo el 2026-10-05, fix-319-m bloque 1): las policies
-- de professional_promotions, promotion_courses y class_book solo exigían
-- auth_user_role() IN ('admin','secretary'). Una secretaria de la sede 1 (sin Clase Profesional)
-- leía 12 promociones, 48 cursos y 25 libros de la sede 2, y editó y borró una promoción de la
-- sede 2. 0047-b las había dejado fuera porque el módulo estaba bloqueado en el piloto; hoy
-- Promociones y Libro de clases están visibles.
--
-- Decisión D5 (Matías, 2026-10-05): la secretaria ve y edita datos operativos (número, nombre…);
-- crear, finalizar y cancelar promociones es solo del admin.
--
-- Patrón (igual que 20261001150000_rls_aislamiento_por_sede.sql, ver DG-098):
--   auth_user_role() = 'admin'
--   OR (auth_user_role() = 'secretary' AND <alcance por sede>)
--   OR <cláusula de alumno vigente, sin cambios>
-- <alcance por sede> replica branch_visible() (grant multi-sede → todo; sede NULL → visible),
-- evaluado una vez por query: (SELECT auth_can_access_both_branches()) / (SELECT auth_user_branch_id())
-- y, en tablas sin branch_id, <fk> IN (SELECT id FROM professional_promotions WHERE <sede>).
--
-- Permisos de la secretaria tras esta migración:
--   professional_promotions  SELECT/UPDATE de su sede. UPDATE solo sobre promociones 'planned' o
--                            'in_progress' y sin poder dejarlas 'finished'/'cancelled' (USING +
--                            WITH CHECK sobre status). INSERT y DELETE: solo admin.
--   promotion_courses        SELECT/UPDATE de su sede (el editor propaga el número a los cursos).
--                            INSERT y DELETE: solo admin (los cursos nacen al crear la promoción).
--   promotion_course_lecturers  SELECT sin cambios (USING true). INSERT/UPDATE de su sede.
--                            DELETE: solo admin (sin cambios).
--   class_book               SELECT/INSERT de su sede; UPDATE de su sede si status <> 'closed'
--                            (regla previa); DELETE: solo admin (sin cambios).
-- Las escrituras de pg_cron y de las edge functions usan la service key y no pasan por RLS.
-- Los triggers que cascadean el estado (cascade_promotion_status_to_courses) son SECURITY DEFINER.
--
-- Requiere fix-320-m aplicado (20261005120000): sin él, los libros con branch_id NULL se verían
-- igual (NULL = visible) pero sin sede real.
--
-- Rollback: recrear las policies con la cláusula de rol original de
-- 20260301000011_10_rls_policies.sql (489-529, 666-676), 20260303120000 (select_class_book) y
-- 20260325100000 (promotion_course_lecturers).
--
-- Idempotente: DROP POLICY IF EXISTS + CREATE POLICY. Sin funciones nuevas.
-- ============================================================================


-- ── 1. professional_promotions ──────────────────────────────────────────────

DROP POLICY IF EXISTS select_professional_promotions ON public.professional_promotions;
CREATE POLICY select_professional_promotions ON public.professional_promotions
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL
             OR branch_id = (SELECT auth_user_branch_id())))
    OR auth_user_role() = 'student'
  );

DROP POLICY IF EXISTS insert_professional_promotions ON public.professional_promotions;
CREATE POLICY insert_professional_promotions ON public.professional_promotions
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');

DROP POLICY IF EXISTS update_professional_promotions ON public.professional_promotions;
CREATE POLICY update_professional_promotions ON public.professional_promotions
  FOR UPDATE
  USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND status IN ('planned', 'in_progress')
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL
             OR branch_id = (SELECT auth_user_branch_id())))
  )
  WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND status IN ('planned', 'in_progress')
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL
             OR branch_id = (SELECT auth_user_branch_id())))
  );

DROP POLICY IF EXISTS delete_professional_promotions ON public.professional_promotions;
CREATE POLICY delete_professional_promotions ON public.professional_promotions
  FOR DELETE USING (auth_user_role() = 'admin');


-- ── 2. promotion_courses (alcance: sede de la promoción) ────────────────────

DROP POLICY IF EXISTS select_promotion_courses ON public.promotion_courses;
CREATE POLICY select_promotion_courses ON public.promotion_courses
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR promotion_id IN (SELECT pp.id FROM public.professional_promotions pp
                                  WHERE pp.branch_id IS NULL
                                     OR pp.branch_id = (SELECT auth_user_branch_id()))))
    OR auth_user_role() = 'student'
  );

DROP POLICY IF EXISTS insert_promotion_courses ON public.promotion_courses;
CREATE POLICY insert_promotion_courses ON public.promotion_courses
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');

DROP POLICY IF EXISTS update_promotion_courses ON public.promotion_courses;
CREATE POLICY update_promotion_courses ON public.promotion_courses
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR promotion_id IN (SELECT pp.id FROM public.professional_promotions pp
                                  WHERE pp.branch_id IS NULL
                                     OR pp.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS delete_promotion_courses ON public.promotion_courses;
CREATE POLICY delete_promotion_courses ON public.promotion_courses
  FOR DELETE USING (auth_user_role() = 'admin');


-- ── 3. promotion_course_lecturers (alcance: sede de la promoción del curso) ─

DROP POLICY IF EXISTS insert_promotion_course_lecturers ON public.promotion_course_lecturers;
CREATE POLICY insert_promotion_course_lecturers ON public.promotion_course_lecturers
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR promotion_course_id IN (
                  SELECT pc.id FROM public.promotion_courses pc
                    JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                   WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT auth_user_branch_id()))))
  );

DROP POLICY IF EXISTS update_promotion_course_lecturers ON public.promotion_course_lecturers;
CREATE POLICY update_promotion_course_lecturers ON public.promotion_course_lecturers
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR promotion_course_id IN (
                  SELECT pc.id FROM public.promotion_courses pc
                    JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                   WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT auth_user_branch_id()))))
  );


-- ── 4. class_book ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS select_class_book ON public.class_book;
CREATE POLICY select_class_book ON public.class_book
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL
             OR branch_id = (SELECT auth_user_branch_id())))
    OR (auth_user_role() = 'student'
        AND promotion_course_id IN (
          SELECT promotion_course_id FROM public.enrollments
           WHERE student_id = auth_student_id() AND promotion_course_id IS NOT NULL))
  );

DROP POLICY IF EXISTS insert_class_book ON public.class_book;
CREATE POLICY insert_class_book ON public.class_book
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL
             OR branch_id = (SELECT auth_user_branch_id())))
  );

DROP POLICY IF EXISTS update_class_book ON public.class_book;
CREATE POLICY update_class_book ON public.class_book
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND status <> 'closed'
        AND ((SELECT auth_can_access_both_branches())
             OR branch_id IS NULL
             OR branch_id = (SELECT auth_user_branch_id())))
  );
