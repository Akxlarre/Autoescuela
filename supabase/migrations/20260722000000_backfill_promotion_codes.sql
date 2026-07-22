-- fix-053-m: backfill del ID numérico MTT en professional_promotions.code
-- y propagación a promotion_courses.code ("{promoCode}.{sufijo de licencia}").
-- Idempotente: solo toca filas cuyo code no sigue ya el formato esperado.

-- 1. Asigna un ID numérico secuencial coherente (100, 101, 102…, por start_date)
--    a las promociones que hoy tienen code null o no-numérico.
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY start_date, id) AS rn
  FROM professional_promotions
  WHERE code IS NULL OR code !~ '^[0-9]+$'
)
UPDATE professional_promotions p
SET code = (100 + ordered.rn - 1)::text
FROM ordered
WHERE p.id = ordered.id;

-- 2. Recalcula promotion_courses.code = "{promoCode}.{sufijo}" para las filas
--    cuyo code no siga ya ese formato.
UPDATE promotion_courses pc
SET code = pp.code || '.' || substring(c.license_class FROM '[2-5]')
FROM professional_promotions pp, courses c
WHERE pc.promotion_id = pp.id
  AND pc.course_id = c.id
  AND pp.code IS NOT NULL
  AND (pc.code IS NULL OR pc.code !~ '^[0-9]+\.[0-9]$');
