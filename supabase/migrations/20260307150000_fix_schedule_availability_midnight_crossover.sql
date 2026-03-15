-- ============================================================================
-- CORRECCIÓN: Slots de medianoche en v_class_b_schedule_availability
-- ============================================================================
-- Problema detectado:
--
-- generate_series genera slots de 45 min de forma continua (sin resetear por día),
-- por lo que durante la ventana nocturna entre el fin de un día (ej. 18:00) y el
-- inicio del siguiente (ej. 08:00), se producen slots como 23:45–00:30.
--
-- El filtro existente:
--   ((gs + INTERVAL '45 minutes') AT TIME ZONE 'America/Santiago')::TIME <= i.available_until
-- NO atrapa este caso porque el cast ::TIME pierde el contexto de fecha:
--   00:30::TIME <= 18:00::TIME  →  TRUE  (falso positivo → slot visible en UI)
--
-- Corrección:
-- Se añade la condición:
--   ((gs + INTERVAL '45 minutes') AT TIME ZONE 'America/Santiago')::TIME
--     > (gs AT TIME ZONE 'America/Santiago')::TIME
--
-- Esta condición es FALSE cuando el slot cruza la medianoche (slot_end < slot_start
-- en términos de TIME puro), descartando correctamente 23:45–00:30 y similares.
-- ============================================================================

DROP VIEW IF EXISTS v_class_b_schedule_availability;

CREATE OR REPLACE VIEW v_class_b_schedule_availability AS
WITH slots AS (
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
  -- Slots de 45 min en las próximas 4 semanas, con zona horaria explícita.
  -- El límite superior usa available_until para que el día 28 genere slots completos.
  CROSS JOIN LATERAL generate_series(
    (CURRENT_DATE + i.available_from)  AT TIME ZONE 'America/Santiago',
    ((CURRENT_DATE + INTERVAL '28 days')::DATE + i.available_until) AT TIME ZONE 'America/Santiago',
    INTERVAL '45 minutes'
  ) AS gs
  WHERE
    i.active = true
    -- Excluir instructores exclusivamente teóricos.
    AND (i.type IS NULL OR i.type != 'theory')
    -- Solo días hábiles del instructor, evaluados en hora local Santiago
    AND EXTRACT(ISODOW FROM gs AT TIME ZONE 'America/Santiago')::INT = ANY(i.available_days)
    -- El slot debe iniciarse dentro de la ventana horaria (hora local Santiago)
    AND (gs AT TIME ZONE 'America/Santiago')::TIME >= i.available_from
    -- El slot completo (45 min) debe terminar dentro de la ventana horaria (hora local Santiago)
    AND ((gs + INTERVAL '45 minutes') AT TIME ZONE 'America/Santiago')::TIME <= i.available_until
    -- CORRECCIÓN: Descartar slots que cruzan la medianoche.
    -- Si slot_end::TIME < slot_start::TIME, el slot cruza las 00:00 y es inválido.
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
  'Zona horaria: America/Santiago explícita en generate_series, ISODOW y comparaciones TIME. '
  'Excluye instructores con type=''theory''. Solo incluye el vehículo activo del instructor. '
  'Filtra por available_days/from/until. Descarta slots que cruzan medianoche. '
  'Usar con rol secretary/admin para el flujo de matrícula Clase B (RF-046).';
