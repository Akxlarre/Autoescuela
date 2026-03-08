-- ============================================================================
-- MEJORA: Exponer slots ocupados en v_class_b_schedule_availability
-- ============================================================================
-- Problema resuelto:
--
-- La vista anterior filtraba los slots ocupados con NOT EXISTS en el WHERE,
-- haciendo que desaparecieran por completo del grid de agenda en el wizard
-- de matrícula. El frontend esperaba poder mostrarlos en gris ("Ocupado")
-- para mejorar la UX, pero nunca los recibía.
--
-- Solución:
-- Se reemplaza el filtro WHERE NOT EXISTS por un campo calculado slot_status
-- (TEXT: 'available' | 'occupied'). La vista ahora retorna TODOS los slots
-- dentro de la ventana horaria del instructor, indicando en cada uno si está
-- libre o ya tiene una sesión confirmada (instructor o vehículo solapado).
--
-- Impacto en el facade:
-- EnrollmentFacade.buildScheduleGrid() lee s.slot_status y lo mapea al tipo
-- SlotStatus del modelo UI. El template ya tenía la rama @if (slot.status ===
-- 'occupied') implementada, por lo que la UI funciona sin cambios de template.
-- ============================================================================

DROP VIEW IF EXISTS v_class_b_schedule_availability;

-- La vista genera TODOS los slots de 45 min para cada par instructor+vehículo
-- en las próximas 4 semanas, incluyendo los ya reservados. Cada slot incluye
-- slot_status = 'available' | 'occupied' para que el frontend pueda renderizar
-- el estado correcto sin ocultar los horarios ocupados.
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
    -- type IS NULL o 'practice' o 'both' → se incluyen.
    -- type = 'theory' → se excluyen.
    AND (i.type IS NULL OR i.type != 'theory')
    -- Solo días hábiles del instructor, evaluados en hora local Santiago
    AND EXTRACT(ISODOW FROM gs AT TIME ZONE 'America/Santiago')::INT = ANY(i.available_days)
    -- El slot debe iniciarse dentro de la ventana horaria (hora local Santiago)
    AND (gs AT TIME ZONE 'America/Santiago')::TIME >= i.available_from
    -- El slot completo (45 min) debe terminar dentro de la ventana horaria (hora local Santiago)
    AND ((gs + INTERVAL '45 minutes') AT TIME ZONE 'America/Santiago')::TIME <= i.available_until
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
  'Filtra por available_days/from/until. NO filtra ocupados: los expone con slot_status para la UI. '
  'Usar con rol secretary/admin para el flujo de matrícula Clase B (RF-046).';
