-- fix-393-m: cleanup_expired_drafts() no borra el `user` de un alumno que sigue existiendo.
--
-- Al vencer un borrador, la función borraba el `user` si `supabase_uid IS NULL` y no era
-- instructor, sin revisar que su `student` siguiera existiendo. El `student` se conserva cuando
-- le queda otra matrícula, así que el DELETE de `users` chocaba con `students_user_id_fkey`.
-- La función no tiene bloque EXCEPTION: ese error abortaba toda la corrida del cron y ningún
-- borrador vencido se borraba. Antes de borrar el `user`, además, ya había borrado sus
-- notificaciones.
--
-- Hasta ahora casi todo alumno matriculado tenía `supabase_uid` porque la invitación lo crea.
-- Con el portal del alumno en piloto no se invita, así que ninguno lo tendrá.
--
-- Cambios (solo la sección "users huérfanos"; el resto es idéntico a la versión desplegada):
--   1. Un `user` solo es candidato si no le queda ningún `student`.
--   2. Cada `user` se borra en su propio bloque: `users` tiene decenas de FKs entrantes sin
--      ON DELETE, y una referencia inesperada ahora conserva ese `user` (con sus
--      notificaciones) y avisa, en vez de abortar la limpieza completa.
--
-- CREATE OR REPLACE conserva los permisos (fix-191) pero no el `search_path` (fix-363): se
-- declara de nuevo acá.

CREATE OR REPLACE FUNCTION public.cleanup_expired_drafts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  expired_ids       INTEGER[];
  orphan_student_ids INTEGER[];
  orphan_user_ids    INTEGER[];
  orphan_user_id     INTEGER;
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

  RETURN deleted_count;
END;
$$;
