-- ============================================================================
-- Eliminar columna redundante student_id de license_validations
-- ============================================================================
-- La FK student_id es innecesaria porque enrollment_id → enrollments.student_id
-- ya provee la relación al alumno. Tener ambas introduce riesgo de inconsistencia.
-- ============================================================================

ALTER TABLE license_validations DROP COLUMN IF EXISTS student_id;

COMMENT ON TABLE license_validations IS
  'Convalidación simultánea de licencias profesionales: A2+A4 (madre=A2) o A5+A3 (madre=A5). '
  'Un solo registro por matrícula. El alumno se obtiene vía enrollment_id → enrollments.student_id. '
  '(RF-064, RF-065, RF-066)';
