-- ============================================================================
-- Rediseño de license_validations: modelo de 1 enrollment + soporte A5+A3
-- ============================================================================
-- Contexto de negocio:
--   El diseño original asumía DOS enrollments por convalidación (enrollment_a2_id
--   + enrollment_a4_id). La definición correcta es UN SOLO enrollment (el del curso
--   madre) con un registro de convalidación asociado.
--   Además, el diseño original solo cubría el par A2+A4; se agrega soporte para
--   el par A5+A3 (A5 madre).
--
-- Pares válidos:
--   A2 (madre) → convalida A4  |  A5 (madre) → convalida A3
--
-- Nota: la tabla ya tiene RLS habilitado y sus 4 policies (select/insert/update/delete)
--   para admin y secretary. No se tocan las policies existentes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Eliminar columnas del diseño anterior (dos FKs de enrollment)
-- ----------------------------------------------------------------------------
ALTER TABLE license_validations
  DROP COLUMN IF EXISTS enrollment_a2_id,
  DROP COLUMN IF EXISTS enrollment_a4_id;

-- ----------------------------------------------------------------------------
-- 2. Agregar columnas del nuevo diseño
-- ----------------------------------------------------------------------------

-- enrollment_id: el único enrollment del alumno (apunta al curso madre: A2 o A5)
ALTER TABLE license_validations
  ADD COLUMN IF NOT EXISTS enrollment_id INT REFERENCES enrollments(id) ON DELETE CASCADE;

-- convalidated_license: qué licencia se convalida simultáneamente
ALTER TABLE license_validations
  ADD COLUMN IF NOT EXISTS convalidated_license TEXT;

-- convalidation_promotion_course_id: FK al promotion_course del contenido CONV
-- (CONV A4 o CONV A3) dentro de la misma promoción. Contenedor de sesiones;
-- sin enrollments propios.
ALTER TABLE license_validations
  ADD COLUMN IF NOT EXISTS convalidation_promotion_course_id INT
    REFERENCES promotion_courses(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 3. Constraints de integridad
-- ----------------------------------------------------------------------------

-- Solo valores válidos para el curso convalidado
ALTER TABLE license_validations
  ADD CONSTRAINT chk_convalidated_license
    CHECK (convalidated_license IN ('A4', 'A3'));

-- Un alumno no puede tener más de un registro de convalidación por enrollment
ALTER TABLE license_validations
  ADD CONSTRAINT uq_license_validations_enrollment
    UNIQUE (enrollment_id);

-- ----------------------------------------------------------------------------
-- 4. Índice para consultas por enrollment
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_license_validations_enrollment
  ON license_validations(enrollment_id);

-- ----------------------------------------------------------------------------
-- 5. Comentarios actualizados
-- ----------------------------------------------------------------------------
COMMENT ON TABLE license_validations IS
  'Convalidación simultánea de licencias profesionales: A2+A4 (madre=A2) o A5+A3 (madre=A5). '
  'Un solo registro por matrícula. El alumno vive en el curso madre; este registro apunta '
  'a su único enrollment y al promotion_course del contenido CONV dentro de la misma promoción. '
  '(RF-064, RF-065, RF-066)';

COMMENT ON COLUMN license_validations.enrollment_id IS
  'FK al único enrollment del alumno (curso madre: A2 o A5). CASCADE al borrar.';

COMMENT ON COLUMN license_validations.convalidated_license IS
  'Licencia que se convalida simultáneamente: ''A4'' cuando la madre es A2, ''A3'' cuando la madre es A5.';

COMMENT ON COLUMN license_validations.convalidation_promotion_course_id IS
  'FK al promotion_course del curso CONV (conv_a4 o conv_a3) dentro de la misma promoción. '
  'Es un contenedor de sesiones académicas; no tiene enrollments propios y no cuenta contra cupo.';

COMMENT ON COLUMN license_validations.reduced_hours IS
  'Total de horas del curso convalidado en modalidad simultánea (RF-064). Default 60.';

COMMENT ON COLUMN license_validations.book2_open_date IS
  'Fecha de apertura del libro del curso convalidado (RF-065): típicamente 2 semanas después del inicio.';

COMMENT ON COLUMN license_validations.history_ref_id IS
  'Referencia a enrollment histórico para trazabilidad de cadena de licencias (RF-066).';
