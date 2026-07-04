-- ============================================================================
-- Spec 0001 — Motor de Ciclos Teóricos (Clase B)
--
-- Reemplaza las sesiones teóricas sueltas + asistencia teórica por un sistema de
-- CICLOS: cohortes de 2 semanas (Lun–Vie de la semana siguiente) con 6 clases
-- fijas (Lun/Mié/Vie). El alumno se asigna automáticamente al matricularse
-- Clase B (RF-04/05/06). La asistencia teórica deja de existir.
--
-- Cambios:
--   1. Recrear v_student_progress_b SIN pct_theory_attendance.
--   2. DROP class_b_theory_attendance.
--   3. Reutilizar class_b_theory_sessions como "clases del ciclo" (vaciar + columnas).
--   4. Nueva tabla class_b_theory_cycles (+ RLS).
--   5. enrollments.theory_cycle_id.
--   6. ensure_theory_cycle() (find-or-create + genera 6 clases) + trigger BEFORE.
--   7. cron auto_transition_theory_cycle_status().
--   8. Backfill de matrículas Clase B activas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Recrear v_student_progress_b sin la métrica de asistencia teórica.
--    (DROP necesario porque CREATE OR REPLACE no permite quitar columnas.)
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS v_student_progress_b;

CREATE VIEW v_student_progress_b AS
SELECT
  m.id AS enrollment_id,
  s.id AS student_id,
  COUNT(DISTINCT cb.id) FILTER (WHERE cb.status = 'completed')            AS completed_practices,
  ROUND(COUNT(DISTINCT cb.id) FILTER (WHERE cb.status = 'completed') / 12.0 * 100)
                                                                          AS pct_practices,
  MAX(cb.updated_at)                                                      AS last_practice_session
FROM enrollments m
JOIN  courses  c ON c.id = m.course_id
JOIN  students s ON s.id = m.student_id
LEFT JOIN class_b_sessions cb ON cb.enrollment_id = m.id
WHERE c.type = 'class_b'
GROUP BY m.id, s.id;

ALTER VIEW v_student_progress_b SET (security_invoker = true);

COMMENT ON VIEW v_student_progress_b IS
  'Progreso académico alumno Clase B: prácticas completadas (DISTINCT) y % prácticas. '
  'La asistencia teórica fue eliminada (Spec 0001 — Ciclos Teóricos).';

-- ----------------------------------------------------------------------------
-- 2. Eliminar la asistencia teórica (dato irrelevante por decisión de negocio).
--    CASCADE arrastra cualquier objeto dependiente.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS class_b_theory_attendance CASCADE;

-- ----------------------------------------------------------------------------
-- 3. Tabla de ciclos.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS class_b_theory_cycles (
  id          SERIAL PRIMARY KEY,
  branch_id   INT  NOT NULL REFERENCES branches(id),
  start_date  DATE NOT NULL,                 -- siempre Lunes
  end_date    DATE NOT NULL,                 -- Viernes de la semana siguiente (start + 11)
  status      TEXT NOT NULL DEFAULT 'active', -- 'active' | 'finished'
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, start_date)
);

COMMENT ON TABLE class_b_theory_cycles IS
  'Ciclos teóricos Clase B (Spec 0001): cohorte de 2 semanas, 6 clases L/X/V. '
  'start_date siempre Lunes, end_date = start_date + 11 (Viernes semana 2).';

CREATE INDEX IF NOT EXISTS idx_class_b_theory_cycles_branch_status
  ON class_b_theory_cycles (branch_id, status);

ALTER TABLE class_b_theory_cycles ENABLE ROW LEVEL SECURITY;

-- RLS: Admin CRUD · Secretaria CRUD por sede (branch_visible) · Instructor/Student R
CREATE POLICY select_class_b_theory_cycles ON class_b_theory_cycles
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'instructor', 'student')
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
  );
CREATE POLICY insert_class_b_theory_cycles ON class_b_theory_cycles
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
  );
CREATE POLICY update_class_b_theory_cycles ON class_b_theory_cycles
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
  );
CREATE POLICY delete_class_b_theory_cycles ON class_b_theory_cycles
  FOR DELETE USING (auth_user_role() = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON class_b_theory_cycles TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE class_b_theory_cycles_id_seq TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. Reutilizar class_b_theory_sessions como "clases del ciclo".
--    Se vacía la data legacy (sesiones sueltas ya no aplican) y se añaden columnas.
-- ----------------------------------------------------------------------------
TRUNCATE class_b_theory_sessions RESTART IDENTITY CASCADE;

ALTER TABLE class_b_theory_sessions
  ADD COLUMN IF NOT EXISTS cycle_id     INT REFERENCES class_b_theory_cycles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS class_number SMALLINT,
  ADD COLUMN IF NOT EXISTS class_date   DATE,
  ADD COLUMN IF NOT EXISTS zoom_sent_at TIMESTAMPTZ;

ALTER TABLE class_b_theory_sessions ALTER COLUMN scheduled_at DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_theory_session_cycle_class_number'
  ) THEN
    ALTER TABLE class_b_theory_sessions
      ADD CONSTRAINT uq_theory_session_cycle_class_number UNIQUE (cycle_id, class_number);
  END IF;
END $$;

COMMENT ON TABLE class_b_theory_sessions IS
  'Clases de un ciclo teórico Clase B (Spec 0001): 6 por ciclo (L/X/V × 2 semanas). '
  'class_number 1-6, class_date, zoom_link + zoom_sent_at. Sin asistencia (irrelevante).';

-- ----------------------------------------------------------------------------
-- 5. FK del alumno a su ciclo.
-- ----------------------------------------------------------------------------
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS theory_cycle_id INT REFERENCES class_b_theory_cycles(id);

COMMENT ON COLUMN enrollments.theory_cycle_id IS
  'Ciclo teórico asignado automáticamente a la matrícula Clase B (Spec 0001, RF-06).';

-- ----------------------------------------------------------------------------
-- 6. Find-or-create del ciclo + generación de las 6 clases (reutilizable).
--    Calcula el lunes objetivo a partir de p_ref_date (RF-04/05) en TZ Santiago.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_theory_cycle(p_branch_id INT, p_ref_date DATE)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dow      INT;
  v_monday   DATE;
  v_cycle_id INT;
  v_offsets  INT[] := ARRAY[0, 2, 4, 7, 9, 11];
  v_i        INT;
BEGIN
  IF p_branch_id IS NULL OR p_ref_date IS NULL THEN
    RETURN NULL;
  END IF;

  v_dow    := EXTRACT(ISODOW FROM p_ref_date);    -- 1=Lun … 7=Dom
  v_monday := p_ref_date - (v_dow - 1);           -- lunes de la semana en curso
  IF v_dow > 3 THEN                               -- Jue–Dom → semana siguiente (RF-05)
    v_monday := v_monday + 7;
  END IF;

  SELECT id INTO v_cycle_id
  FROM public.class_b_theory_cycles
  WHERE branch_id = p_branch_id AND start_date = v_monday;

  IF v_cycle_id IS NULL THEN
    INSERT INTO public.class_b_theory_cycles (branch_id, start_date, end_date, status)
    VALUES (p_branch_id, v_monday, v_monday + 11, 'active')
    ON CONFLICT (branch_id, start_date)
      DO UPDATE SET start_date = EXCLUDED.start_date  -- no-op para obtener RETURNING
    RETURNING id INTO v_cycle_id;

    FOR v_i IN 1..6 LOOP
      INSERT INTO public.class_b_theory_sessions (cycle_id, branch_id, class_number, class_date, status)
      VALUES (v_cycle_id, p_branch_id, v_i, v_monday + v_offsets[v_i], 'scheduled')
      ON CONFLICT (cycle_id, class_number) DO NOTHING;
    END LOOP;
  END IF;

  RETURN v_cycle_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_theory_cycle(INT, DATE) IS
  'Spec 0001. Devuelve (creando si no existe) el ciclo teórico de la sede para la '
  'fecha dada: lunes objetivo por RF-04/05; al crear genera las 6 clases L/X/V.';

-- Trigger BEFORE: fija theory_cycle_id al activarse una matrícula Clase B (RF-06).
CREATE OR REPLACE FUNCTION public.assign_theory_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'active'
     AND NEW.license_group = 'class_b'
     AND NEW.theory_cycle_id IS NULL THEN
    NEW.theory_cycle_id := public.ensure_theory_cycle(
      NEW.branch_id,
      (NOW() AT TIME ZONE 'America/Santiago')::date
    );
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.assign_theory_cycle() IS
  'Spec 0001 (RF-06). BEFORE INSERT/UPDATE OF status en enrollments: asigna el ciclo '
  'teórico al pasar una matrícula Clase B a active. Cubre presencial, online y re-matrícula.';

DROP TRIGGER IF EXISTS trg_assign_theory_cycle ON enrollments;
CREATE TRIGGER trg_assign_theory_cycle
  BEFORE INSERT OR UPDATE OF status ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_theory_cycle();

-- ----------------------------------------------------------------------------
-- 7. Transición automática active → finished (pg_cron diario).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_transition_theory_cycle_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.class_b_theory_cycles
  SET    status = 'finished'
  WHERE  status   = 'active'
    AND  end_date < CURRENT_DATE;
END;
$$;

COMMENT ON FUNCTION public.auto_transition_theory_cycle_status() IS
  'Spec 0001. Invocada por pg_cron: marca finished los ciclos cuyo end_date ya pasó.';

SELECT cron.unschedule('auto-transition-theory-cycle-status')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'auto-transition-theory-cycle-status'
  );

SELECT cron.schedule(
  'auto-transition-theory-cycle-status',
  '0 6 * * *',
  $$ SELECT public.auto_transition_theory_cycle_status(); $$
);

-- ----------------------------------------------------------------------------
-- 8. Backfill: asignar ciclo a las matrículas Clase B activas existentes.
-- ----------------------------------------------------------------------------
UPDATE enrollments e
SET    theory_cycle_id = public.ensure_theory_cycle(e.branch_id, CURRENT_DATE)
WHERE  e.status        = 'active'
  AND  e.license_group = 'class_b'
  AND  e.branch_id IS NOT NULL
  AND  e.theory_cycle_id IS NULL;
