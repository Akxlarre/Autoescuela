-- Fix: cleanup_expired_drafts() en producción era una versión antigua sin cascade correcto,
-- que violaba la FK constraint "class_b_sessions_enrollment_id_fkey".
--
-- Lógica: todo draft expirado se elimina completamente con cascade correcto.
-- Un draft no puede tener total_paid > 0 en el flujo correcto, porque el pago
-- solo ocurre dentro de la RPC confirm_enrollment_with_payment, que simultáneamente
-- cambia el status a 'active'. Por diseño, no existen drafts con dinero real asociado.
--
-- El enrollment 103 (anomalía del flujo viejo) debe resolverse manualmente antes
-- de aplicar esta migración si se quiere preservar su registro de pago.
--
-- Orden de eliminación (respetando todas las FKs):
--   biometric_records.class_b_session_id → SET NULL
--   route_incidents.class_b_session_id   → SET NULL
--   class_b_practice_attendance          → DELETE
--   class_b_sessions                     → DELETE
--   license_validations                  → DELETE
--   discount_applications                → DELETE
--   payments                             → DELETE
--   student_documents                    → DELETE
--   digital_contracts                    → DELETE
--   enrollments                          → DELETE

CREATE OR REPLACE FUNCTION cleanup_expired_drafts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_ids   INTEGER[];
  deleted_count INTEGER;
BEGIN
  SELECT ARRAY_AGG(id) INTO expired_ids
  FROM enrollments
  WHERE status = 'draft'
    AND expires_at < NOW();

  IF expired_ids IS NULL OR ARRAY_LENGTH(expired_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Desreferenciar FKs nullable a class_b_sessions
  UPDATE biometric_records
  SET class_b_session_id = NULL
  WHERE class_b_session_id IN (
    SELECT id FROM class_b_sessions WHERE enrollment_id = ANY(expired_ids)
  );

  UPDATE route_incidents
  SET class_b_session_id = NULL
  WHERE class_b_session_id IN (
    SELECT id FROM class_b_sessions WHERE enrollment_id = ANY(expired_ids)
  );

  DELETE FROM class_b_practice_attendance
  WHERE class_b_session_id IN (
    SELECT id FROM class_b_sessions WHERE enrollment_id = ANY(expired_ids)
  );

  DELETE FROM class_b_sessions      WHERE enrollment_id = ANY(expired_ids);
  DELETE FROM license_validations   WHERE enrollment_id = ANY(expired_ids);
  DELETE FROM discount_applications WHERE enrollment_id = ANY(expired_ids);
  DELETE FROM payments              WHERE enrollment_id = ANY(expired_ids);
  DELETE FROM student_documents     WHERE enrollment_id = ANY(expired_ids);
  DELETE FROM digital_contracts     WHERE enrollment_id = ANY(expired_ids);

  DELETE FROM enrollments WHERE id = ANY(expired_ids);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
