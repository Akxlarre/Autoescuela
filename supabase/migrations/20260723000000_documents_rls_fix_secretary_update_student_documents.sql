-- ============================================================
-- Migration: Fix H-028 — secretaria no puede actualizar
--            student_documents en matrícula Profesional (403)
--
-- Problema (fix-054-m, originado de ASG-011):
--   update_student_documents solo permite 'admin' o 'student' (dueño).
--   insert_student_documents SÍ permite 'secretary', pero el endpoint de
--   subida hace un upsert (on_conflict=enrollment_id,type): cuando ya
--   existe una fila para ese (enrollment_id, type), Postgres resuelve el
--   conflicto como UPDATE, no INSERT, y la secretaria recibe 403.
--
-- Solución: agregar rama 'secretary' a update_student_documents, con el
-- mismo scope por sede que ya usa select_student_documents (branch_visible
-- vía el enrollment asociado, ya que student_documents no tiene branch_id
-- propio).
-- ============================================================

DROP POLICY IF EXISTS update_student_documents ON public.student_documents;

CREATE POLICY update_student_documents ON public.student_documents
  FOR UPDATE USING (
    -- Admin: acceso total
    auth_user_role() = 'admin'

    -- Secretary: solo matrículas de su(s) sede(s)
    OR (
      auth_user_role() = 'secretary'
      AND enrollment_id IN (
        SELECT id FROM public.enrollments WHERE branch_visible(branch_id)
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
