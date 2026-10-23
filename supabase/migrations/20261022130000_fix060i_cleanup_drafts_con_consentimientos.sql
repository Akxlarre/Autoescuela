-- fix-060-i: cleanup_expired_drafts() no se cae con un borrador vencido que tiene consentimientos.
--
-- consents.enrollment_id apunta a enrollments sin ON DELETE, y consents es append-only
-- (Ley 21.719, spec 0009-m): no se puede borrar ni desvincular. Un solo borrador vencido con
-- consentimiento hacía chocar el DELETE de enrollments y abortaba toda la corrida del cron.
--
-- Ahora esos borradores se pasan a 'cancelled' y se les borran las clases prácticas (libera la
-- agenda). Sus pagos no se tocan (B1-1 de fix-058-i, decisión pendiente). El resto de los
-- borradores vencidos sigue el camino de siempre (idéntico a fix-393-m).
--
-- Al cancelar se limpia expires_at: chk_expires_at_draft_only exige expires_at NULL fuera de
-- 'draft'.
--
-- CREATE OR REPLACE conserva los permisos (fix-191) pero no el search_path (fix-363).

CREATE OR REPLACE FUNCTION public.cleanup_expired_drafts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  expired_ids        INTEGER[];
  consented_ids      INTEGER[];
  orphan_student_ids INTEGER[];
  orphan_user_ids    INTEGER[];
  orphan_user_id     INTEGER;
  cancelled_count    INTEGER := 0;
  deleted_count      INTEGER;
BEGIN
  -- Recolectar IDs expirados
  SELECT ARRAY_AGG(id) INTO expired_ids
  FROM public.enrollments
  WHERE status = 'draft'
    AND expires_at < NOW();

  IF expired_ids IS NULL OR ARRAY_LENGTH(expired_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- ── Borradores con consentimientos: se cancelan, no se borran (fix-060-i) ──
  SELECT ARRAY_AGG(DISTINCT c.enrollment_id) INTO consented_ids
  FROM public.consents c
  WHERE c.enrollment_id = ANY(expired_ids);

  IF consented_ids IS NOT NULL THEN
    UPDATE public.route_incidents
    SET class_b_session_id = NULL
    WHERE class_b_session_id IN (
      SELECT id FROM public.class_b_sessions WHERE enrollment_id = ANY(consented_ids)
    );

    DELETE FROM public.class_b_practice_attendance
    WHERE class_b_session_id IN (
      SELECT id FROM public.class_b_sessions WHERE enrollment_id = ANY(consented_ids)
    );

    DELETE FROM public.class_b_sessions WHERE enrollment_id = ANY(consented_ids);

    UPDATE public.enrollments
    SET status = 'cancelled', expires_at = NULL
    WHERE id = ANY(consented_ids);
    GET DIAGNOSTICS cancelled_count = ROW_COUNT;

    SELECT ARRAY_AGG(id) INTO expired_ids
    FROM UNNEST(expired_ids) AS id
    WHERE id <> ALL(consented_ids);

    IF expired_ids IS NULL THEN
      RETURN cancelled_count;
    END IF;
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
  --   · No le queda student   → protege al alumno que conserva otra matrícula (fix-393-m)

  IF orphan_user_ids IS NOT NULL AND ARRAY_LENGTH(orphan_user_ids, 1) > 0 THEN
    FOREACH orphan_user_id IN ARRAY orphan_user_ids LOOP
      CONTINUE WHEN NOT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = orphan_user_id
          AND u.supabase_uid IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.instructors i WHERE i.user_id = u.id)
          AND NOT EXISTS (SELECT 1 FROM public.students s WHERE s.user_id = u.id)
      );

      -- Un bloque por user: si algo todavía lo referencia, se deshace solo este bloque
      -- (el user conserva sus notificaciones) y la limpieza sigue con el resto.
      BEGIN
        -- notifications.recipient_id REFERENCES users(id) sin ON DELETE → se borran antes.
        DELETE FROM public.notifications WHERE recipient_id = orphan_user_id;
        DELETE FROM public.users WHERE id = orphan_user_id;
      EXCEPTION WHEN foreign_key_violation THEN
        RAISE WARNING 'cleanup_expired_drafts: se conserva el user % porque aún tiene referencias (%)',
          orphan_user_id, SQLERRM;
      END;
    END LOOP;
  END IF;

  RETURN deleted_count + cancelled_count;
END;
$$;
