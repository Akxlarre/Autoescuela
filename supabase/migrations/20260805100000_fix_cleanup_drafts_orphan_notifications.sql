-- Corrige cleanup_expired_drafts(): al borrar un `user` huérfano (draft de matrícula
-- expirado, sin supabase_uid, no instructor), la función no borraba las `notifications`
-- que apuntan a ese `user_id` (recipient_id), violando notifications_recipient_id_fkey
-- (REFERENCES users(id) sin ON DELETE, default NO ACTION).
--
-- Como la función no tiene bloque EXCEPTION, este error abortaba TODA la transacción
-- del cron nocturno (no solo el DELETE de users) — ningún draft expirado de esa corrida
-- se borraba mientras existiera al menos un user huérfano con notificaciones propias.
--
-- Fix: borrar las notifications del user huérfano antes de borrar el user, siguiendo el
-- mismo patrón de cascade manual ya usado en el resto de la función.

CREATE OR REPLACE FUNCTION cleanup_expired_drafts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_ids       INTEGER[];
  orphan_student_ids INTEGER[];
  orphan_user_ids    INTEGER[];
  deleted_count     INTEGER;
BEGIN
  -- Recolectar IDs expirados
  SELECT ARRAY_AGG(id) INTO expired_ids
  FROM public.enrollments
  WHERE status = 'draft'
    AND expires_at < NOW();

  IF expired_ids IS NULL OR ARRAY_LENGTH(expired_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Capturar student_id y user_id ANTES de borrar (las FKs desaparecerán con el DELETE)
  SELECT ARRAY_AGG(DISTINCT e.student_id) INTO orphan_student_ids
  FROM public.enrollments e
  WHERE e.id = ANY(expired_ids)
    AND e.student_id IS NOT NULL;

  SELECT ARRAY_AGG(DISTINCT s.user_id) INTO orphan_user_ids
  FROM public.students s
  WHERE s.id = ANY(orphan_student_ids)
    AND s.user_id IS NOT NULL;

  -- ── Cascade de datos asociados al enrollment ──────────────────────────────
  -- (biometric_records fue eliminada en 20260622000001_drop_biometric_records.sql —
  -- no reintroducir esa referencia)

  UPDATE public.route_incidents
  SET class_b_session_id = NULL
  WHERE class_b_session_id IN (
    SELECT id FROM public.class_b_sessions WHERE enrollment_id = ANY(expired_ids)
  );

  DELETE FROM public.class_b_practice_attendance
  WHERE class_b_session_id IN (
    SELECT id FROM public.class_b_sessions WHERE enrollment_id = ANY(expired_ids)
  );

  DELETE FROM public.class_b_sessions      WHERE enrollment_id = ANY(expired_ids);
  DELETE FROM public.license_validations   WHERE enrollment_id = ANY(expired_ids);
  DELETE FROM public.discount_applications WHERE enrollment_id = ANY(expired_ids);
  DELETE FROM public.payments              WHERE enrollment_id = ANY(expired_ids);
  DELETE FROM public.student_documents     WHERE enrollment_id = ANY(expired_ids);
  DELETE FROM public.digital_contracts     WHERE enrollment_id = ANY(expired_ids);

  DELETE FROM public.enrollments WHERE id = ANY(expired_ids);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- ── Limpiar students huérfanos ────────────────────────────────────────────
  -- Solo si no les quedan otras matrículas en el sistema.

  IF orphan_student_ids IS NOT NULL AND ARRAY_LENGTH(orphan_student_ids, 1) > 0 THEN
    DELETE FROM public.students s
    WHERE s.id = ANY(orphan_student_ids)
      AND NOT EXISTS (
        SELECT 1 FROM public.enrollments e2
        WHERE e2.student_id = s.id
      );
  END IF;

  -- ── Limpiar users huérfanos ───────────────────────────────────────────────
  -- Solo si:
  --   · supabase_uid IS NULL  → nunca fue activado como cuenta Auth (protege admins/secretarias)
  --   · No es instructor      → protege instructores sin cuenta Auth aún

  IF orphan_user_ids IS NOT NULL AND ARRAY_LENGTH(orphan_user_ids, 1) > 0 THEN
    -- Borrar notifications propias del user huérfano ANTES del DELETE de users
    -- (notifications.recipient_id REFERENCES users(id) sin ON DELETE → NO ACTION,
    -- bloqueaba el DELETE de abajo con FK violation).
    DELETE FROM public.notifications n
    WHERE n.recipient_id = ANY(orphan_user_ids)
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = n.recipient_id
          AND u.supabase_uid IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.instructors i WHERE i.user_id = u.id)
      );

    DELETE FROM public.users u
    WHERE u.id = ANY(orphan_user_ids)
      AND u.supabase_uid IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.instructors i WHERE i.user_id = u.id
      );
  END IF;

  RETURN deleted_count;
END;
$$;
