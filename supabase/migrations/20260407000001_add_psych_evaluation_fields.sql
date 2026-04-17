-- ============================================================================
-- Campos de evaluación del test psicológico por admin/secretaria
-- ============================================================================
-- Permite guardar la evaluación (apto/no apto) de forma independiente
-- a la conversión a matrícula, ya que ocurren en momentos distintos.
-- ============================================================================

ALTER TABLE professional_pre_registrations
  ADD COLUMN IF NOT EXISTS psych_evaluated_by       INT  REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS psych_evaluated_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS psych_rejection_reason   TEXT;

COMMENT ON COLUMN professional_pre_registrations.psych_evaluated_by
  IS 'Usuario (admin/secretaria) que evaluó el test psicológico';
COMMENT ON COLUMN professional_pre_registrations.psych_evaluated_at
  IS 'Fecha y hora en que se registró la evaluación del test';
COMMENT ON COLUMN professional_pre_registrations.psych_rejection_reason
  IS 'Observaciones del evaluador cuando psych_test_result = ''unfit''';

-- RLS: ya habilitado en la tabla original (02_enrollments_and_courses.sql).
-- Las policies existentes (admin y secretary pueden SELECT/UPDATE registros
-- de su branch_id) cubren automáticamente las nuevas columnas.
