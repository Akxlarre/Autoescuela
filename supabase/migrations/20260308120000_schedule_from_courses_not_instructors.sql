-- ============================================================================
-- Migración: Horarios de clase B definidos por la autoescuela (courses), no
-- por cada instructor individual.
-- ============================================================================
--
-- Cambio de modelo:
--   ANTES: Cada instructor tenía available_days, available_from, available_until.
--   AHORA: El horario operativo se define en la tabla `courses` con columnas
--          schedule_days, schedule_blocks (bloques horarios del día).
--          Todos los instructores comparten el mismo horario de la autoescuela.
--
-- Horario Clase B / Clase B SENCE:
--   Lun-Vie (ISODOW 1-5), 09:00-13:00 y 15:00-19:00
--   Slots de 45 min.
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Agregar columnas de horario operativo a `courses`
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS schedule_days    INT[]   DEFAULT '{1,2,3,4,5}',
  ADD COLUMN IF NOT EXISTS schedule_blocks  JSONB   DEFAULT '[{"from":"09:00","to":"13:00"},{"from":"15:00","to":"19:00"}]';

COMMENT ON COLUMN courses.schedule_days   IS 'Días operativos (ISODOW): 1=Lun..7=Dom. Default Lun-Vie.';
COMMENT ON COLUMN courses.schedule_blocks IS 'Bloques horarios del día como array JSON [{from, to}]. Slots de 45 min se generan dentro de cada bloque.';

-- Poblar valores explícitos para cursos existentes de Clase B
UPDATE courses
SET schedule_days   = '{1,2,3,4,5}',
    schedule_blocks = '[{"from":"09:00","to":"13:00"},{"from":"15:00","to":"19:00"}]'::JSONB
WHERE type = 'class_b';

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Eliminar columnas de disponibilidad individual de `instructors`
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE instructors
  DROP COLUMN IF EXISTS available_days,
  DROP COLUMN IF EXISTS available_from,
  DROP COLUMN IF EXISTS available_until;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Recrear vista v_class_b_schedule_availability
-- ──────────────────────────────────────────────────────────────────────────────
-- Ahora genera slots a partir de courses.schedule_days/schedule_blocks en lugar
-- de instructor.available_days/available_from/available_until.
-- Aplica a cursos type = 'class_b' (incluye class_b y class_b_sence).
-- ──────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS v_class_b_schedule_availability;

CREATE OR REPLACE VIEW v_class_b_schedule_availability AS
WITH
-- Extraer bloques horarios únicos por sede para cursos class_b.
-- DISTINCT ON (branch_id, block_from, block_to) evita duplicados cuando una sede
-- tiene múltiples cursos class_b con el mismo horario (ej: class_b y class_b_sence).
course_blocks AS (
  SELECT DISTINCT ON (c.branch_id, (b.value ->> 'from')::TIME, (b.value ->> 'to')::TIME)
    c.branch_id,
    c.schedule_days,
    (b.value ->> 'from')::TIME AS block_from,
    (b.value ->> 'to')::TIME   AS block_to
  FROM courses c,
       LATERAL jsonb_array_elements(c.schedule_blocks) AS b(value)
  WHERE c.type = 'class_b'
    AND c.active = true
),
-- Generar todos los slots de 45 min para cada instructor + vehículo + bloque
slots AS (
  SELECT
    i.id                               AS instructor_id,
    va.vehicle_id,
    gs                                 AS slot_start,
    gs + INTERVAL '45 minutes'         AS slot_end
  FROM instructors i
  JOIN users u
    ON u.id = i.user_id
  -- Solo el vehículo actualmente asignado al instructor (end_date IS NULL = activo)
  JOIN vehicle_assignments va
    ON va.instructor_id = i.id
   AND va.end_date IS NULL
  -- El vehículo debe pertenecer a la misma sede que el instructor
  JOIN vehicles v
    ON v.id = va.vehicle_id
   AND v.branch_id = u.branch_id
  -- Bloques horarios del curso de la misma sede
  JOIN course_blocks cb
    ON cb.branch_id = u.branch_id
  -- Slots de 45 min en las próximas 4 semanas
  CROSS JOIN LATERAL generate_series(
    (CURRENT_DATE + cb.block_from) AT TIME ZONE 'America/Santiago',
    ((CURRENT_DATE + INTERVAL '28 days')::DATE + cb.block_to) AT TIME ZONE 'America/Santiago',
    INTERVAL '45 minutes'
  ) AS gs
  WHERE
    i.active = true
    -- Excluir instructores exclusivamente teóricos
    AND (i.type IS NULL OR i.type != 'theory')
    -- Solo días operativos de la autoescuela (evaluados en hora local Santiago)
    AND EXTRACT(ISODOW FROM gs AT TIME ZONE 'America/Santiago')::INT = ANY(cb.schedule_days)
    -- El slot debe iniciarse dentro del bloque horario (hora local Santiago)
    AND (gs AT TIME ZONE 'America/Santiago')::TIME >= cb.block_from
    -- El slot completo (45 min) debe terminar dentro del bloque (hora local Santiago)
    AND ((gs + INTERVAL '45 minutes') AT TIME ZONE 'America/Santiago')::TIME <= cb.block_to
    -- Descartar slots que cruzan la medianoche
    AND ((gs + INTERVAL '45 minutes') AT TIME ZONE 'America/Santiago')::TIME
          > (gs AT TIME ZONE 'America/Santiago')::TIME
)
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
  'Horarios derivados de courses.schedule_days/schedule_blocks (no de instructors). '
  'Excluye instructores con type=''theory''. Solo incluye el vehículo activo del instructor. '
  'Usar con rol secretary/admin para el flujo de matrícula Clase B (RF-046).';
