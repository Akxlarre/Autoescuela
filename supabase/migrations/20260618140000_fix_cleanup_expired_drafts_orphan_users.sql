-- Extiende cleanup_expired_drafts() para eliminar también los registros
-- de students y users creados durante el wizard de matrícula que quedaron
-- huérfanos al expirar el draft, siempre que sea seguro borrarlos.
--
-- Guards antes de borrar:
--
--   students: solo si no tiene NINGUNA otra matrícula (activa, completada, draft) fuera
--             del conjunto expirado que estamos borrando.
--
--   users:    solo si cumple AMBAS condiciones:
--             1. supabase_uid IS NULL — nunca activó una cuenta en Supabase Auth.
--                Admins y secretarias siempre tienen supabase_uid (necesitan iniciar sesión),
--                por lo que quedan protegidos automáticamente.
--             2. NOT EXISTS en la tabla instructors — cubre el edge case de un instructor
--                recién dado de alta sin cuenta Auth todavía.
--
-- Por qué no hay guard para secretarias/admins:
--   Cualquier persona con rol de staff que pueda ingresar al sistema tiene
--   supabase_uid != NULL. El guard (1) es suficiente para protegerlos.

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

  UPDATE public.biometric_records
  SET class_b_session_id = NULL
  WHERE class_b_session_id IN (
    SELECT id FROM public.class_b_sessions WHERE enrollment_id = ANY(expired_ids)
  );

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
