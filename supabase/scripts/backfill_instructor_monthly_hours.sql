-- ============================================================================
-- BACKFILL: instructor_monthly_hours
--
-- Inserta / actualiza todos los registros basándose en las class_b_sessions
-- con status='completed' ya existentes en la BD.
--
-- Fórmula: cada sesión práctica = 45 min = 0.75 h
--   total_equivalent = practical_sessions × 0.75
--
-- Ejecutar UNA SOLA VEZ contra la BD de producción, DESPUÉS de aplicar la
-- migración 20260509000001_trg_instructor_monthly_hours_autorecalc.sql.
-- ============================================================================

BEGIN;

INSERT INTO instructor_monthly_hours
  (instructor_id, period, theory_hours, practical_sessions, total_equivalent)
SELECT
  instructor_id,
  TO_CHAR(scheduled_at AT TIME ZONE 'America/Santiago', 'YYYY-MM') AS period,
  0                                                                  AS theory_hours,
  COUNT(*)                                                           AS practical_sessions,
  ROUND((COUNT(*) * 0.75)::NUMERIC, 1)                              AS total_equivalent
FROM  class_b_sessions
WHERE status       = 'completed'
  AND scheduled_at IS NOT NULL
GROUP BY
  instructor_id,
  TO_CHAR(scheduled_at AT TIME ZONE 'America/Santiago', 'YYYY-MM')
ON CONFLICT (instructor_id, period) DO UPDATE SET
  practical_sessions = EXCLUDED.practical_sessions,
  total_equivalent   = EXCLUDED.total_equivalent;

-- Verificación: registros insertados/actualizados
SELECT
  u.first_names || ' ' || u.paternal_last_name AS instructor,
  imh.period,
  imh.practical_sessions                        AS sesiones,
  imh.total_equivalent || ' hrs'                AS total_horas
FROM  instructor_monthly_hours imh
JOIN  instructors i ON i.id = imh.instructor_id
JOIN  users       u ON u.id = i.user_id
ORDER BY imh.period DESC, instructor;

COMMIT;
