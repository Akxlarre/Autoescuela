-- Fix: cleanup_expired_drafts violaba FK constraint
-- "class_b_practice_attendance_class_b_session_id_fkey" al borrar class_b_sessions
-- porque class_b_practice_attendance referencia class_b_sessions(id).
-- Solución: borrar los registros de asistencia práctica ANTES de borrar las sesiones.

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

  -- 1. Desreferenciar FKs nullable a class_b_sessions (biometric_records, route_incidents)
  UPDATE biometric_records
  SET class_b_session_id = NULL
  WHERE class_b_session_id IN (
    SELECT id FROM class_b_sessions
    WHERE enrollment_id = ANY(expired_ids)
  );

  UPDATE route_incidents
  SET class_b_session_id = NULL
  WHERE class_b_session_id IN (
    SELECT id FROM class_b_sessions
    WHERE enrollment_id = ANY(expired_ids)
  );

  -- 2. Borrar asistencia práctica Clase B antes de borrar las sesiones
  DELETE FROM class_b_practice_attendance
  WHERE class_b_session_id IN (
    SELECT id FROM class_b_sessions
    WHERE enrollment_id = ANY(expired_ids)
  );

  -- 3. Borrar todas las sesiones Clase B del draft (sin filtrar por status)
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
