-- ============================================================================
-- Backfill class_number en class_b_sessions
--
-- Asigna class_number a todas las sesiones que lo tienen en NULL,
-- numerándolas en orden cronológico de scheduled_at dentro de cada enrollment.
--
-- Ejecutar UNA SOLA VEZ en producción tras el deploy de los cambios en
-- enrollment.facade.ts, public-enrollment y student-payment.
-- ============================================================================

UPDATE class_b_sessions
SET class_number = sub.rn
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY enrollment_id
      ORDER BY scheduled_at
    ) AS rn
  FROM class_b_sessions
  WHERE class_number IS NULL
) sub
WHERE class_b_sessions.id = sub.id;
