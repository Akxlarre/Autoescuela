-- Fix: cleanup_expired_drafts eliminaba class_b_sessions solo con status='reserved',
-- dejando sesiones con otros status (ej. 'scheduled') que bloqueaban el DELETE de
-- enrollments por FK constraint "class_b_sessions_enrollment_id_fkey".
-- Solución: borrar TODAS las class_b_sessions del enrollment draft expirado.

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

  -- Borrar datos asociados en orden (respetando FKs).
  -- Se eliminan TODAS las class_b_sessions del draft (sin filtrar por status)
  -- para evitar FK violation al borrar el enrollment padre.
  DELETE FROM class_b_sessions
  WHERE enrollment_id = ANY(expired_ids);

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
