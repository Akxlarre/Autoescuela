-- ============================================================================
-- Rediseño de professional_module_grades para escala 10–100 (RF-072)
-- ============================================================================
-- Contexto:
--   La tabla fue creada con escala chilena 1.0–7.0 (educación general).
--   Clase Profesional usa escala MTT: 10–100, mínimo de aprobación 75.
--   Se agrega: módulo numérico, estado borrador/confirmado y unicidad.
-- ============================================================================

BEGIN;

-- 1. Eliminar constraint de rango antiguo (escala 1.0–7.0)
ALTER TABLE professional_module_grades
  DROP CONSTRAINT IF EXISTS chk_grade_range;

-- 2. Ampliar precisión de la columna grade para soportar hasta 100.0
--    NUMERIC(3,1) solo permite hasta 9.9 con 1 decimal → necesita NUMERIC(5,1)
ALTER TABLE professional_module_grades
  ALTER COLUMN grade TYPE NUMERIC(5,1);

-- 3. Nuevo constraint: escala MTT 10–100 con 1 decimal
ALTER TABLE professional_module_grades
  ADD CONSTRAINT chk_grade_range CHECK (grade BETWEEN 10.0 AND 100.0);

-- 4. Agregar número de módulo (1–7) para orden y unicidad
ALTER TABLE professional_module_grades
  ADD COLUMN IF NOT EXISTS module_number SMALLINT;

ALTER TABLE professional_module_grades
  ADD CONSTRAINT chk_module_number CHECK (module_number BETWEEN 1 AND 7);

COMMENT ON COLUMN professional_module_grades.module_number IS
  'Número de módulo (1–7). El nombre del módulo 5 varía según license_class del curso: '
  'A2/A3 → Transporte de Pasajeros, A4/A5 → Transporte de Carga / Sust. Peligrosa.';

-- 5. Columna de texto libre del módulo pasa a ser derivable desde module_number + curso.
--    Se conserva como campo de referencia histórico pero ya no es la fuente de verdad.
COMMENT ON COLUMN professional_module_grades.module IS
  'Nombre descriptivo del módulo (legacy). La fuente de verdad es module_number.';

-- 6. Estado: borrador vs confirmado
--    'draft'     → ingresado pero aún editable
--    'confirmed' → nota bloqueada / enviada al libro de clases
ALTER TABLE professional_module_grades
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE professional_module_grades
  ADD CONSTRAINT chk_grade_status CHECK (status IN ('draft', 'confirmed'));

COMMENT ON COLUMN professional_module_grades.status IS
  'Estado de la nota: draft = borrador editable, confirmed = bloqueada en el libro.';

-- 7. Unicidad: un solo registro por matrícula × módulo
--    (evita duplicados al guardar borrador múltiples veces)
ALTER TABLE professional_module_grades
  ADD CONSTRAINT uq_enrollment_module UNIQUE (enrollment_id, module_number);

-- 8. Actualizar passed: ahora la nota mínima de aprobación es 75 (no 4.0)
COMMENT ON COLUMN professional_module_grades.passed IS
  'true si grade >= 75.0 (mínimo de aprobación MTT Art. 16). '
  'Calculado y persistido al guardar/confirmar en el Facade.';

-- 9. Actualizar comentario de la tablaA
COMMENT ON TABLE professional_module_grades IS
  'Notas por módulo técnico profesional, escala MTT 10–100, mínimo aprobación 75 (RF-072). '
  '7 módulos por curso; módulo 5 varía según license_class (A2/A3 = Pasajeros, A4/A5 = Carga).';

-- 10. Índice para carga por curso (vía enrollment → promotion_course)
CREATE INDEX IF NOT EXISTS idx_prof_module_grades_enrollment
  ON professional_module_grades(enrollment_id, module_number);

COMMIT;
