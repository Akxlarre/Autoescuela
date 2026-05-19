-- ============================================================================
-- Migración: Actualizar horarios de Clase B a slots exactos con pausas de 5 min
-- ============================================================================
-- Cambio de modelo en courses.schedule_blocks:
--   ANTES: Rangos continuos; la vista generaba slots de 45 min con generate_series
--          [{"from":"09:00","to":"13:00"},{"from":"15:00","to":"19:00"}]
--   AHORA: Cada elemento del array ES un slot exacto de 45 min
--          [{"from":"08:30","to":"09:15"}, {"from":"09:20","to":"10:05"}, ...]
--
-- Nuevos horarios L-V (ambas sedes):
--   08:30-09:15 | 09:20-10:05 | 10:10-10:55 | 11:00-11:45 | 11:50-12:35
--   12:40-13:25 | 15:00-15:45 | 15:50-16:35 | 16:40-17:25 | 17:30-18:15
--   18:20-19:05 | 19:10-19:55 | 20:00-20:45
--
-- Actualiza:
--   1. DEFAULT de courses.schedule_blocks
--   2. Todos los cursos class_b existentes (ambas sedes)
--   3. Vista v_class_b_schedule_availability (ya no usa generate_series de 45 min)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Actualizar DEFAULT de la columna (aplica a cursos nuevos)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE courses
  ALTER COLUMN schedule_blocks
  SET DEFAULT '[
    {"from":"08:30","to":"09:15"},
    {"from":"09:20","to":"10:05"},
    {"from":"10:10","to":"10:55"},
    {"from":"11:00","to":"11:45"},
    {"from":"11:50","to":"12:35"},
    {"from":"12:40","to":"13:25"},
    {"from":"15:00","to":"15:45"},
    {"from":"15:50","to":"16:35"},
    {"from":"16:40","to":"17:25"},
    {"from":"17:30","to":"18:15"},
    {"from":"18:20","to":"19:05"},
    {"from":"19:10","to":"19:55"},
    {"from":"20:00","to":"20:45"}
  ]'::JSONB;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Actualizar todos los cursos class_b existentes (ambas sedes)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE courses
SET schedule_blocks = '[
  {"from":"08:30","to":"09:15"},
  {"from":"09:20","to":"10:05"},
  {"from":"10:10","to":"10:55"},
  {"from":"11:00","to":"11:45"},
  {"from":"11:50","to":"12:35"},
  {"from":"12:40","to":"13:25"},
  {"from":"15:00","to":"15:45"},
  {"from":"15:50","to":"16:35"},
  {"from":"16:40","to":"17:25"},
  {"from":"17:30","to":"18:15"},
  {"from":"18:20","to":"19:05"},
  {"from":"19:10","to":"19:55"},
  {"from":"20:00","to":"20:45"}
]'::JSONB
WHERE type = 'class_b';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Recrear v_class_b_schedule_availability
--    Nuevo modelo: cada elemento JSONB ES un slot; se expande directamente
--    a los días operativos de las próximas 4 semanas.
--    Ya no se usa generate_series con INTERVAL '45 minutes'.
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_class_b_schedule_availability;

CREATE OR REPLACE VIEW v_class_b_schedule_availability AS
WITH
-- Slots horarios únicos por sede.
-- DISTINCT ON (branch_id, slot_from) evita duplicados cuando una sede
-- tiene múltiples cursos class_b con idénticos horarios (class_b + class_b_sence).
course_slots AS (
  SELECT DISTINCT ON (c.branch_id, (b.value ->> 'from')::TIME)
    c.branch_id,
    c.schedule_days,
    (b.value ->> 'from')::TIME AS slot_from,
    (b.value ->> 'to')::TIME   AS slot_to
  FROM courses c,
       LATERAL jsonb_array_elements(c.schedule_blocks) AS b(value)
  WHERE c.type = 'class_b'
    AND c.active = true
  ORDER BY c.branch_id, (b.value ->> 'from')::TIME
),
-- Expandir cada slot a los próximos 28 días, filtrando por días operativos.
-- Se genera una fila por (instructor, vehículo, slot, día).
slots AS (
  SELECT
    i.id        AS instructor_id,
    va.vehicle_id,
    (d::DATE + cs.slot_from) AT TIME ZONE 'America/Santiago' AS slot_start,
    (d::DATE + cs.slot_to)   AT TIME ZONE 'America/Santiago' AS slot_end
  FROM instructors i
  JOIN users u
    ON u.id = i.user_id
  JOIN vehicle_assignments va
    ON va.instructor_id = i.id
   AND va.end_date IS NULL
  JOIN vehicles v
    ON v.id = va.vehicle_id
   AND v.branch_id = u.branch_id
  JOIN course_slots cs
    ON cs.branch_id = u.branch_id
  -- Generar un día por iteración para las próximas 4 semanas
  CROSS JOIN LATERAL generate_series(
    CURRENT_DATE::TIMESTAMP,
    (CURRENT_DATE + INTERVAL '28 days')::TIMESTAMP,
    INTERVAL '1 day'
  ) AS d
  WHERE
    i.active = true
    -- Excluir instructores exclusivamente teóricos
    AND (i.type IS NULL OR i.type != 'theory')
    -- Solo días operativos (ISODOW sobre la fecha local generada)
    AND EXTRACT(ISODOW FROM d)::INT = ANY(cs.schedule_days)
)
-- Marcar cada slot como disponible u ocupado según conflictos de instructor y vehículo
SELECT
  s.*,
  CASE
    WHEN
      -- Sin conflicto de instructor
      NOT EXISTS (
        SELECT 1
        FROM class_b_sessions cb
        JOIN enrollments e ON e.id = cb.enrollment_id
        WHERE cb.instructor_id = s.instructor_id
          AND cb.status NOT IN ('cancelled')
          AND (e.status != 'draft' OR e.expires_at > NOW())
          AND cb.scheduled_at < s.slot_end
          AND (cb.scheduled_at + (cb.duration_min * INTERVAL '1 minute')) > s.slot_start
      )
      -- Sin conflicto de vehículo
      AND NOT EXISTS (
        SELECT 1
        FROM class_b_sessions cb
        JOIN enrollments e ON e.id = cb.enrollment_id
        WHERE cb.vehicle_id = s.vehicle_id
          AND cb.status NOT IN ('cancelled')
          AND (e.status != 'draft' OR e.expires_at > NOW())
          AND cb.scheduled_at < s.slot_end
          AND (cb.scheduled_at + (cb.duration_min * INTERVAL '1 minute')) > s.slot_start
      )
    THEN 'available'
    ELSE 'occupied'
  END AS slot_status
FROM slots s;

ALTER VIEW v_class_b_schedule_availability SET (security_invoker = true);

COMMENT ON VIEW v_class_b_schedule_availability IS
  'Slots de 45 min (disponibles Y ocupados) por instructor+vehículo en las próximas 4 semanas. '
  'Columna slot_status = ''available'' | ''occupied'' indica disponibilidad real. '
  'Zona horaria: America/Santiago explícita. '
  'Horarios L-V: 08:30-09:15, 09:20-10:05, 10:10-10:55, 11:00-11:45, 11:50-12:35, '
  '12:40-13:25, 15:00-15:45, 15:50-16:35, 16:40-17:25, 17:30-18:15, '
  '18:20-19:05, 19:10-19:55, 20:00-20:45. '
  'Cada elemento de courses.schedule_blocks es un slot exacto (no rango continuo). '
  'DISTINCT ON en course_slots evita duplicados por múltiples cursos class_b en la misma sede. '
  'Excluye instructores con type=''theory''. Solo incluye el vehículo activo del instructor.';
