-- ============================================================================
-- Trigger: auto-actualiza instructor_monthly_hours cuando una sesión práctica
--          Clase B cambia a status='completed' (o sale de él).
--
-- Fórmula acordada: cada sesión práctica = 45 min = 0.75 h
--   total_equivalent = practical_sessions × 0.75
--
-- ============================================================================

-- ── 1. Helper: recalcula y upserta el registro de un instructor+periodo ──────

CREATE OR REPLACE FUNCTION recalc_instructor_monthly_hours(
  p_instructor_id INT,
  p_period        TEXT   -- formato 'YYYY-MM'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sessions INT;
  v_total_eq NUMERIC(6,1);
BEGIN
  SELECT COUNT(*)
  INTO   v_sessions
  FROM   class_b_sessions
  WHERE  instructor_id = p_instructor_id
    AND  status        = 'completed'
    AND  scheduled_at  IS NOT NULL
    AND  TO_CHAR(scheduled_at AT TIME ZONE 'America/Santiago', 'YYYY-MM') = p_period;

  v_total_eq := ROUND((v_sessions * 0.75)::NUMERIC, 1);

  IF v_sessions > 0 THEN
    INSERT INTO instructor_monthly_hours
      (instructor_id, period, theory_hours, practical_sessions, total_equivalent)
    VALUES
      (p_instructor_id, p_period, 0, v_sessions, v_total_eq)
    ON CONFLICT (instructor_id, period) DO UPDATE SET
      practical_sessions = EXCLUDED.practical_sessions,
      total_equivalent   = EXCLUDED.total_equivalent;
  ELSE
    -- Sin sesiones completadas en el periodo: limpiar la fila si existe
    DELETE FROM instructor_monthly_hours
    WHERE  instructor_id = p_instructor_id
      AND  period        = p_period;
  END IF;
END;
$$;

-- ── 2. Función de trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_class_b_sessions_update_monthly_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_period TEXT;
  v_new_period TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed' AND NEW.scheduled_at IS NOT NULL THEN
      PERFORM recalc_instructor_monthly_hours(
        NEW.instructor_id,
        TO_CHAR(NEW.scheduled_at AT TIME ZONE 'America/Santiago', 'YYYY-MM')
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Solo actuar si el status involucra 'completed' (transición de entrada o salida)
    IF OLD.status IS DISTINCT FROM NEW.status AND
       (OLD.status = 'completed' OR NEW.status = 'completed') THEN

      v_new_period := TO_CHAR(NEW.scheduled_at AT TIME ZONE 'America/Santiago', 'YYYY-MM');
      PERFORM recalc_instructor_monthly_hours(NEW.instructor_id, v_new_period);

      -- Si además cambió el instructor o el mes, recalcular el slot anterior también
      IF OLD.instructor_id != NEW.instructor_id OR
         TO_CHAR(OLD.scheduled_at AT TIME ZONE 'America/Santiago', 'YYYY-MM') != v_new_period THEN
        v_old_period := TO_CHAR(OLD.scheduled_at AT TIME ZONE 'America/Santiago', 'YYYY-MM');
        PERFORM recalc_instructor_monthly_hours(OLD.instructor_id, v_old_period);
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'completed' AND OLD.scheduled_at IS NOT NULL THEN
      PERFORM recalc_instructor_monthly_hours(
        OLD.instructor_id,
        TO_CHAR(OLD.scheduled_at AT TIME ZONE 'America/Santiago', 'YYYY-MM')
      );
    END IF;
  END IF;

  RETURN NULL; -- AFTER trigger: valor de retorno ignorado para INSERT/UPDATE/DELETE
END;
$$;

-- ── 3. Trigger sobre class_b_sessions ────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_class_b_sessions_monthly_hours ON class_b_sessions;

CREATE TRIGGER trg_class_b_sessions_monthly_hours
  AFTER INSERT OR UPDATE OR DELETE ON class_b_sessions
  FOR EACH ROW
  EXECUTE FUNCTION trg_class_b_sessions_update_monthly_hours();
