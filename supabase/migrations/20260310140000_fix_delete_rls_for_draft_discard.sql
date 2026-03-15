-- ============================================================================
-- Fix: Políticas DELETE de student_documents y digital_contracts
-- ============================================================================
-- Problema: La secretaria no podía descartar borradores de matrículas
-- profesionales porque las policies DELETE de estas tablas solo permitían
-- 'admin'. Esto causaba que el delete silencioso fallara (0 filas) y luego
-- el DELETE en enrollments lanzara FK violation 23503.
--
-- La función cleanup_expired_drafts() funciona porque es SECURITY DEFINER
-- (bypassea RLS), pero el facade corre como el usuario autenticado.
-- ============================================================================

-- student_documents: Admin + Secretary pueden eliminar (Sec necesita poder
-- limpiar documentos al descartar un draft de matrícula)
DROP POLICY IF EXISTS delete_student_documents ON public.student_documents;
CREATE POLICY delete_student_documents ON public.student_documents
  FOR DELETE USING (
    public.auth_user_role() IN ('admin', 'secretary')
  );

-- digital_contracts: Admin + Secretary pueden eliminar (Sec necesita poder
-- limpiar el contrato generado al descartar un draft de matrícula)
DROP POLICY IF EXISTS delete_digital_contracts ON public.digital_contracts;
CREATE POLICY delete_digital_contracts ON public.digital_contracts
  FOR DELETE USING (
    public.auth_user_role() IN ('admin', 'secretary')
  );
