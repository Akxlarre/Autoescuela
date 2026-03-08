-- ============================================================================
-- FIX: Duplicación de slots en v_class_b_schedule_availability
-- ============================================================================
-- Causa: El CTE course_blocks generaba una fila por cada curso class_b de la
-- sede (class_b + class_b_sence). Al hacer JOIN con instructors por branch_id,
-- cada instructor obtenía 2x el mismo bloque → slots duplicados en la UI.
--
-- Solución: DISTINCT ON (branch_id, block_from, block_to) en course_blocks
-- para garantizar un único bloque horario por combinación sede+horario.
-- ============================================================================

DROP VIEW IF EXISTS v_class_b_schedule_availability;

CREATE OR REPLACE VIEW v_class_b_schedule_availability AS
WITH
-- Bloques horarios únicos por sede. DISTINCT ON evita duplicados cuando hay
-- múltiples cursos class_b con el mismo horario (ej: class_b y class_b_sence).
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
-- Slots de 45 min para cada instructor + vehículo + bloque
slots AS (
  SELECT
    i.id                               AS instructor_id,
    va.vehicle_id,
    gs                                 AS slot_start,
    gs + INTERVAL '45 minutes'         AS slot_end
  FROM instructors i
  JOIN users u
    ON u.id = i.user_id
  JOIN vehicle_assignments va
    ON va.instructor_id = i.id
   AND va.end_date IS NULL
  JOIN vehicles v
    ON v.id = va.vehicle_id
   AND v.branch_id = u.branch_id
  JOIN course_blocks cb
    ON cb.branch_id = u.branch_id
  CROSS JOIN LATERAL generate_series(
    (CURRENT_DATE + cb.block_from) AT TIME ZONE 'America/Santiago',
    ((CURRENT_DATE + INTERVAL '28 days')::DATE + cb.block_to) AT TIME ZONE 'America/Santiago',
    INTERVAL '45 minutes'
  ) AS gs
  WHERE
    i.active = true
    AND (i.type IS NULL OR i.type != 'theory')
    AND EXTRACT(ISODOW FROM gs AT TIME ZONE 'America/Santiago')::INT = ANY(cb.schedule_days)
    AND (gs AT TIME ZONE 'America/Santiago')::TIME >= cb.block_from
    AND ((gs + INTERVAL '45 minutes') AT TIME ZONE 'America/Santiago')::TIME <= cb.block_to
    AND ((gs + INTERVAL '45 minutes') AT TIME ZONE 'America/Santiago')::TIME
          > (gs AT TIME ZONE 'America/Santiago')::TIME
)
SELECT
  s.*,
  CASE
    WHEN
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
  'Horarios derivados de courses.schedule_days/schedule_blocks (horario operativo de la autoescuela). '
  'DISTINCT ON en course_blocks evita duplicados por múltiples cursos class_b en la misma sede. '
  'Excluye instructores con type=''theory''. Solo incluye el vehículo activo del instructor. '
  'Usar con rol secretary/admin para el flujo de matrícula Clase B (RF-046).';
