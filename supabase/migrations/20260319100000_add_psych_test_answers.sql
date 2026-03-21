-- ============================================================================
-- 20260319100000 — Agregar respuestas del Test Psicológico EPQ a pre-registros
--
-- Contexto: La pre-inscripción profesional incluye un test psicológico online
-- (EPQ de Eysenck, 81 preguntas SI/NO). Las respuestas se almacenan en JSONB
-- para que el psicólogo designado por la autoescuela pueda revisarlas y
-- determinar si el postulante es apto o no apto (psych_test_result: fit/unfit).
-- La edge function NO calcula el resultado — solo guarda las respuestas.
-- ============================================================================

ALTER TABLE professional_pre_registrations
  ADD COLUMN IF NOT EXISTS psych_test_answers     JSONB,
  ADD COLUMN IF NOT EXISTS psych_test_completed_at TIMESTAMPTZ;

-- psych_test_answers: array JSON de 81 booleanos (índice 0 = pregunta 1).
-- Ejemplo: [true, false, true, ...]
-- psych_test_completed_at: timestamp cuando el postulante envió sus respuestas.
-- psych_test_result (ya existía): null hasta que el psicólogo lo evalúe → 'fit' | 'unfit'