-- ============================================================
-- Migration: Acotar RLS de student_documents y digital_contracts
--            para eliminar cross-tenant access (OWASP A01 / CWE-284)
--
-- Problema detectado:
--   • select_student_documents: secretary ve documentos de TODAS las sedes;
--     instructor ve documentos de TODOS los alumnos sin importar si les da clases.
--   • select_digital_contracts: secretary ve contratos de TODAS las sedes.
--
-- Solución:
--   • Secretary → filtrar via branch_visible() usando el branch_id del
--     enrollment asociado (student_documents / digital_contracts no tienen
--     branch_id propio; se obtiene haciendo subquery a enrollments).
--   • Instructor → solo puede ver documentos de alumnos en cuyas matrículas
--     tiene sessions activas (mismo patrón que select_students).
--
-- Nota: Las migraciones anteriores (20260303120000, 20260413000001) corrigieron
-- RLS de storage y update de digital_contracts, pero NO tocaron el SELECT de
-- estas tablas. Esta migración cierra ese hueco remanente.
-- ============================================================


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. student_documents — SELECT
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS select_student_documents ON public.student_documents;

CREATE POLICY select_student_documents ON public.student_documents
  FOR SELECT USING (
    -- Admin: acceso total
    auth_user_role() = 'admin'

    -- Secretary: solo matrículas de su(s) sede(s)
    OR (
      auth_user_role() = 'secretary'
      AND enrollment_id IN (
        SELECT id FROM public.enrollments WHERE branch_visible(branch_id)
      )
    )

    -- Instructor: solo alumnos en cuyas matrículas tiene clases asignadas
    OR (
      auth_user_role() = 'instructor'
      AND enrollment_id IN (
        SELECT e.id
        FROM public.class_b_sessions cb
        JOIN public.enrollments e ON e.id = cb.enrollment_id
        WHERE cb.instructor_id = auth_instructor_id()
          AND cb.status NOT IN ('cancelled')
      )
    )

    -- Student: solo sus propios documentos
    OR (
      auth_user_role() = 'student'
      AND enrollment_id IN (
        SELECT id FROM public.enrollments WHERE student_id = auth_student_id()
      )
    )
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. digital_contracts — SELECT
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS select_digital_contracts ON public.digital_contracts;

CREATE POLICY select_digital_contracts ON public.digital_contracts
  FOR SELECT USING (
    -- Admin: acceso total
    auth_user_role() = 'admin'

    -- Secretary: solo contratos cuya matrícula pertenece a su(s) sede(s)
    -- (digital_contracts.enrollment_id es UNIQUE FK → enrollments)
    OR (
      auth_user_role() = 'secretary'
      AND enrollment_id IN (
        SELECT id FROM public.enrollments WHERE branch_visible(branch_id)
      )
    )

    -- Student: solo su propio contrato
    -- (student_id eliminado en 20260404120000 — se resuelve via enrollment_id)
    OR (
      auth_user_role() = 'student'
      AND enrollment_id IN (
        SELECT id FROM public.enrollments WHERE student_id = auth_student_id()
      )
    )
  );
