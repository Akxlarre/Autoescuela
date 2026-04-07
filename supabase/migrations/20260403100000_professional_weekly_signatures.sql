-- ============================================================================
-- professional_weekly_signatures — Firma semanal de asistencia teórica
-- ============================================================================
-- Los alumnos de Clase Profesional deben firmar presencialmente, al final de
-- cada semana, que asistieron a las clases teóricas de esa semana.
-- Este registro almacena quién firmó y cuándo fue registrado por secretaría.
-- ============================================================================

CREATE TABLE IF NOT EXISTS professional_weekly_signatures (
  id                   SERIAL PRIMARY KEY,
  promotion_course_id  INT  NOT NULL REFERENCES promotion_courses(id) ON DELETE CASCADE,
  enrollment_id        INT  NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  week_start_date      DATE NOT NULL,  -- siempre lunes de la semana
  signed_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by          INT  NOT NULL REFERENCES users(id),
  notes                TEXT,

  UNIQUE (enrollment_id, week_start_date)
);

COMMENT ON TABLE professional_weekly_signatures IS
  'Registro de firma semanal presencial de alumnos de Clase Profesional. '
  'Una fila por alumno × semana, registrada por secretaría al cierre de la semana. '
  'week_start_date es siempre el lunes de la semana correspondiente.';

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE professional_weekly_signatures ENABLE ROW LEVEL SECURITY;

-- Admin: acceso completo
CREATE POLICY "admin_all_weekly_signatures"
  ON professional_weekly_signatures
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.supabase_uid = auth.uid() AND r.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.supabase_uid = auth.uid() AND r.name = 'admin'
    )
  );

-- Secretaría: CRUD
CREATE POLICY "secretary_crud_weekly_signatures"
  ON professional_weekly_signatures
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.supabase_uid = auth.uid() AND r.name = 'secretary'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.supabase_uid = auth.uid() AND r.name = 'secretary'
    )
  );

-- Instructor: solo lectura
CREATE POLICY "instructor_read_weekly_signatures"
  ON professional_weekly_signatures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.supabase_uid = auth.uid() AND r.name = 'instructor'
    )
  );

-- Alumno: solo lectura de sus propias firmas
CREATE POLICY "student_read_own_weekly_signatures"
  ON professional_weekly_signatures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM enrollments e
      JOIN students s ON s.id = e.student_id
      JOIN users u ON u.id = s.user_id
      WHERE e.id = professional_weekly_signatures.enrollment_id
        AND u.supabase_uid = auth.uid()
    )
  );
