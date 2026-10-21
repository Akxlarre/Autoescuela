-- fix-477-m (P10/S26 del checklist 033, ASG-i-033): solo el admin borra documentos de alumno.
--
-- delete_student_documents dejaba a la secretaria borrar cualquier documento de una matrícula de
-- su sede: la pantalla no le muestra "Eliminar", pero por API podía borrar cédulas o certificados
-- médicos. Decisión de Matías (2026-10-20): se cierra en la RLS.
--
-- Excepción: el wizard de matrícula de la secretaria borra documentos mientras la matrícula es
-- BORRADOR (quitar la foto carnet, reemplazar un documento del paso 4, descartar el borrador).
-- Para una matrícula ya confirmada, la secretaria usa "Reemplazar" (UPDATE, fix-471-m).
--
-- Solo DELETE. select/insert/update_student_documents no cambian.
-- Idempotente: DROP POLICY IF EXISTS + CREATE POLICY.
-- Rollback: recrear la policy anterior (admin, o secretaria con branch_visible(enrollments.branch_id)).
-- Verificación: supabase/tests/rls/fix-477-m-borrar-documentos-alumno.sql

DROP POLICY IF EXISTS delete_student_documents ON public.student_documents;
CREATE POLICY delete_student_documents ON public.student_documents
  FOR DELETE USING (
    auth_user_role() = 'admin'
    OR (
      auth_user_role() = 'secretary'
      AND enrollment_id IN (
        SELECT e.id FROM public.enrollments e
         WHERE e.status = 'draft'
           AND branch_visible(e.branch_id)
      )
    )
  );
