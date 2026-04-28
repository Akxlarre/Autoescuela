-- ============================================================
-- Migration: Branch isolation en DELETE de student_documents
--            y digital_contracts para secretarias (OWASP A01)
--
-- Problema: Las policies DELETE solo validaban rol (admin | secretary),
--   sin filtro de sede. Una secretaria podía borrar documentos de
--   alumnos de otra sede si conocía el ID.
--
-- Solución: Misma lógica que select_student_documents /
--   select_digital_contracts (20260413000002): secretary solo opera
--   sobre matrículas visibles a su sede via branch_visible().
-- ============================================================

-- ── student_documents ───────────────────────────────────────
DROP POLICY IF EXISTS delete_student_documents ON public.student_documents;

CREATE POLICY delete_student_documents ON public.student_documents
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (
      auth_user_role() = 'secretary'
      AND enrollment_id IN (
        SELECT id FROM public.enrollments WHERE branch_visible(branch_id)
      )
    )
  );

-- ── digital_contracts ───────────────────────────────────────
DROP POLICY IF EXISTS delete_digital_contracts ON public.digital_contracts;

CREATE POLICY delete_digital_contracts ON public.digital_contracts
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (
      auth_user_role() = 'secretary'
      AND enrollment_id IN (
        SELECT id FROM public.enrollments WHERE branch_visible(branch_id)
      )
    )
  );
