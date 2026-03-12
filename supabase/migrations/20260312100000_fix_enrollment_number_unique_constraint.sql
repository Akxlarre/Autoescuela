-- ============================================================================
-- Migración: Corregir UNIQUE constraint de número de matrícula
--
-- Problema: El constraint enrollments_number_key es UNIQUE(number) global.
--   get_next_enrollment_number genera secuencias independientes por
--   (branch_id × tipo_licencia), por lo que 0001 de Conductores Chillán
--   colisiona con 0001 de Autoescuela Chillán al confirmar la matrícula.
--
-- Solución:
--   1. Agregar columna license_group ('class_b' | 'professional') que se
--      auto-popula vía trigger desde courses.license_class.
--   2. Reemplazar UNIQUE(number) por UNIQUE(number, branch_id, license_group).
--      Los drafts (number IS NULL) quedan excluidos automáticamente porque
--      NULL no satisface igualdad en constraints UNIQUE de Postgres.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Nueva columna license_group en enrollments
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS license_group TEXT
    CHECK (license_group IN ('class_b', 'professional'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Poblar license_group en filas existentes
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE enrollments e
SET license_group = CASE
  WHEN c.license_class = 'B' THEN 'class_b'
  ELSE 'professional'
END
FROM courses c
WHERE c.id = e.course_id
  AND e.license_group IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger para auto-poblar license_group en nuevas matrículas
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_enrollment_license_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT CASE
    WHEN license_class = 'B' THEN 'class_b'
    ELSE 'professional'
  END
  INTO NEW.license_group
  FROM courses
  WHERE id = NEW.course_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_enrollment_license_group ON enrollments;

CREATE TRIGGER trg_set_enrollment_license_group
  BEFORE INSERT ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION set_enrollment_license_group();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Reemplazar el constraint único
-- ─────────────────────────────────────────────────────────────────────────────
-- Eliminar el constraint global antiguo
ALTER TABLE enrollments
  DROP CONSTRAINT IF EXISTS enrollments_number_key;

-- Nuevo constraint: único por (número × sede × tipo de licencia)
-- Esto permite que 0001 exista en branch 1 class_b Y en branch 2 class_b
-- Y también en branch 1 professional, sin colisionar entre sí.
ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_number_branch_group_key
    UNIQUE (number, branch_id, license_group);

COMMENT ON COLUMN enrollments.license_group IS
  'Grupo de licencia derivado de courses.license_class: ''class_b'' para '
  'Clase B, ''professional'' para todos los demás. Junto con branch_id '
  'y number forma el constraint único de numeración correlativa.';
