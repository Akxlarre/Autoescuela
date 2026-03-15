-- ============================================================================
-- Migración: Resiliencia del Wizard de Matrícula (Draft Recovery)
-- ============================================================================
-- Agrega current_step para trackear progreso del wizard en la BD,
-- función de limpieza de drafts expirados y programación pg_cron.
-- ============================================================================

-- 1. Columna current_step para trackear el progreso del wizard (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrollments' AND column_name = 'current_step'
  ) THEN
    ALTER TABLE enrollments
      ADD COLUMN current_step SMALLINT NOT NULL DEFAULT 1
      CONSTRAINT chk_enrollments_current_step CHECK (current_step BETWEEN 1 AND 6);
  END IF;
END;
$$;

-- 2. Función de limpieza de drafts expirados (>24h)
--    Borra datos asociados en orden correcto para respetar FKs,
--    luego elimina los enrollments draft expirados.
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

-- 3. Programar limpieza automática con pg_cron (diariamente a las 3:00 AM UTC)
-- NOTA: pg_cron debe estar habilitado en Supabase (Dashboard > Extensions > pg_cron)
SELECT cron.schedule(
  'cleanup-expired-enrollment-drafts',
  '0 3 * * *',
  $$ SELECT cleanup_expired_drafts(); $$
);
