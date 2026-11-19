-- =============================================================================
-- spec 0012-i, fase 1 — Anticipos fuera de la caja (AC15) y horas exactas (AC17)
-- =============================================================================

-- 1. AC15: el anticipo ya no es plata de la caja (decisión de Ignacio, checklist I07).
--    Se quitan solo los candados de instructor_advances. Las funciones
--    guard_egreso_en_caja_cerrada() y guard_movimiento_caja_cerrada() siguen
--    protegiendo expenses, payments y las demás tablas de la caja (DG-114).
DROP TRIGGER IF EXISTS trg_instructor_advances_insert_update_caja_cerrada
  ON public.instructor_advances;
DROP TRIGGER IF EXISTS trg_instructor_advances_caja_cerrada
  ON public.instructor_advances;

-- 2. AC17: horas exactas, dos decimales (0,75 h por clase; 3 clases = 2,25 h).
ALTER TABLE public.instructor_monthly_hours
  ALTER COLUMN total_equivalent TYPE NUMERIC(6,2);

CREATE OR REPLACE FUNCTION public.recalc_instructor_monthly_hours(
  p_instructor_id INT,
  p_period        TEXT   -- 'YYYY-MM'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_sessions INT;
BEGIN
  SELECT COUNT(*)
  INTO   v_sessions
  FROM   class_b_sessions
  WHERE  instructor_id = p_instructor_id
    AND  status        = 'completed'
    AND  scheduled_at  IS NOT NULL
    AND  TO_CHAR(scheduled_at AT TIME ZONE 'America/Santiago', 'YYYY-MM') = p_period;

  IF v_sessions > 0 THEN
    INSERT INTO instructor_monthly_hours
      (instructor_id, period, theory_hours, practical_sessions, total_equivalent)
    VALUES
      (p_instructor_id, p_period, 0, v_sessions, v_sessions * 0.75)
    ON CONFLICT (instructor_id, period) DO UPDATE SET
      practical_sessions = EXCLUDED.practical_sessions,
      total_equivalent   = EXCLUDED.total_equivalent;
  ELSE
    DELETE FROM instructor_monthly_hours
    WHERE  instructor_id = p_instructor_id
      AND  period        = p_period;
  END IF;
END;
$$;

-- 3. Recalcula lo ya guardado (30 de 51 filas cambian, p. ej. 2,3 → 2,25).
--    Las liquidaciones pagadas (instructor_monthly_payments) guardan su monto y no se tocan.
UPDATE public.instructor_monthly_hours
SET    total_equivalent = practical_sessions * 0.75
WHERE  total_equivalent IS DISTINCT FROM practical_sessions * 0.75;
