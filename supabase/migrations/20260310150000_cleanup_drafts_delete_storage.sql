-- ============================================================================
-- Migración: Limpieza de Storage al descartar Drafts de Matrícula
-- ============================================================================
-- Actualiza cleanup_expired_drafts() para también eliminar los archivos del
-- bucket 'documents' en storage.objects antes de borrar student_documents.
-- La carpeta de cada draft sigue el patrón: students/{enrollment_id}/
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

  -- Eliminar archivos de storage (carpeta students/{id}/) para cada draft expirado
  -- storage.objects es la tabla interna de Supabase que respalda el bucket
  DELETE FROM storage.objects
  WHERE bucket_id = 'documents'
    AND name LIKE ANY(
      SELECT 'students/' || id::TEXT || '/%'
      FROM UNNEST(expired_ids) AS id
    );

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
