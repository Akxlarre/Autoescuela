-- ============================================================================
-- Migración: Corregir cleanup_expired_drafts — eliminar DELETE directo de storage
-- ============================================================================
-- PROBLEMA: El DELETE FROM storage.objects falla con:
--   "Direct deletion from storage tables is not allowed. Use the Storage API instead."
-- El trigger storage.protect_delete() bloquea cualquier DELETE directo desde SQL.
--
-- SOLUCIÓN: La función SQL solo limpia filas de base de datos.
-- Los archivos en storage.objects se limpian mediante una Edge Function separada
-- (o manualmente) que use la Storage API con el service role key.
--
-- IMPACTO: Los archivos en bucket 'documents' bajo students/{id}/ quedan
-- huérfanos hasta la próxima limpieza manual/automática vía Storage API.
-- Esto NO afecta la funcionalidad del sistema.
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_drafts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_ids INTEGER[];
  deleted_count INTEGER;
BEGIN
  -- Recopilar IDs de drafts expirados una sola vez
  SELECT ARRAY_AGG(id) INTO expired_ids
  FROM enrollments
  WHERE status = 'draft' AND expires_at < NOW();

  -- Si no hay drafts expirados, salir
  IF expired_ids IS NULL OR ARRAY_LENGTH(expired_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- NOTA: Los archivos de storage (bucket 'documents', carpeta students/{id}/)
  -- deben eliminarse externamente via Storage API. No es posible hacerlo desde
  -- SQL puro: storage.protect_delete() bloquea DELETE directo en storage.objects.

  -- Borrar datos asociados en orden (respetando FKs)
  DELETE FROM class_b_sessions
  WHERE enrollment_id = ANY(expired_ids) AND status = 'reserved';

  DELETE FROM discount_applications
  WHERE enrollment_id = ANY(expired_ids);

  DELETE FROM payments
  WHERE enrollment_id = ANY(expired_ids);

  DELETE FROM student_documents
  WHERE enrollment_id = ANY(expired_ids);

  DELETE FROM digital_contracts
  WHERE enrollment_id = ANY(expired_ids);

  -- Finalmente borrar los enrollments draft expirados
  DELETE FROM enrollments
  WHERE id = ANY(expired_ids);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
