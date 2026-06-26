-- Elimina la tabla biometric_records que fue planificada pero nunca implementada.
-- No hay datos ni código que la referencie; el model DTO y el entry en DATABASE.md
-- también fueron eliminados en este mismo commit.
--
-- DROP CASCADE elimina automáticamente las RLS policies asociadas.
-- La función cleanup_expired_drafts() se recrea aquí sin la referencia a esta tabla.

DROP TABLE IF EXISTS public.biometric_records CASCADE;

-- Recrea cleanup_expired_drafts() sin el UPDATE biometric_records (tabla ya no existe).
CREATE OR REPLACE FUNCTION cleanup_expired_drafts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_ids        INTEGER[];
  orphan_student_ids INTEGER[];
  orphan_user_ids    INTEGER[];
  deleted_count      INTEGER;
BEGIN
  SELECT ARRAY_AGG(id) INTO expired_ids
  FROM public.enrollments
  WHERE status = 'draft'
    AND expires_at < NOW();

  IF expired_ids IS NULL OR ARRAY_LENGTH(expired_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  SELECT ARRAY_AGG(DISTINCT e.student_id) INTO orphan_student_ids
  FROM public.enrollments e
  WHERE e.id = ANY(expired_ids)
    AND e.student_id IS NOT NULL;

  SELECT ARRAY_AGG(DISTINCT s.user_id) INTO orphan_user_ids
  FROM public.students s
  WHERE s.id = ANY(orphan_student_ids)
    AND s.user_id IS NOT NULL;

  -- ── Cascade de datos asociados al enrollment ──────────────────────────────

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

  IF orphan_student_ids IS NOT NULL AND ARRAY_LENGTH(orphan_student_ids, 1) > 0 THEN
    DELETE FROM public.students s
    WHERE s.id = ANY(orphan_student_ids)
      AND NOT EXISTS (
        SELECT 1 FROM public.enrollments e2
        WHERE e2.student_id = s.id
      );
  END IF;

  -- ── Limpiar users huérfanos ───────────────────────────────────────────────

  IF orphan_user_ids IS NOT NULL AND ARRAY_LENGTH(orphan_user_ids, 1) > 0 THEN
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
