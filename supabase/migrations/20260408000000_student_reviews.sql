-- ============================================================================
-- 11 — Encuestas Post-Curso (Email Feedback)
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_surveys (
  id                  SERIAL PRIMARY KEY,
  enrollment_id       INT    NOT NULL UNIQUE REFERENCES enrollments(id),
  obtained_license    BOOLEAN DEFAULT false,    -- Confirmación del alumno vía encuesta
  municipality        TEXT,                     -- Donde obtuvo la licencia
  satisfaction_rating SMALLINT NOT NULL CHECK (satisfaction_rating BETWEEN 1 AND 5),
  comment             TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE student_surveys IS 'Encuestas de satisfacción enviadas por email tras completar el curso (RF-115)';

-- Permisos RLS
ALTER TABLE student_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Surveys visibles para Admin y Sec" ON student_surveys
  FOR SELECT USING (auth.uid() IN (
    SELECT supabase_uid FROM users WHERE role_id IN (1, 2)
  ));
