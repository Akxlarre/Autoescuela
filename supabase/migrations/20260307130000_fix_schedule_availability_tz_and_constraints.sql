-- ============================================================================
-- CORRECCIÓN: Zona horaria en v_class_b_schedule_availability,
--             constraint único de vehículo activo por instructor,
--             y exclusión de instructores de tipo 'theory'
-- ============================================================================
-- Problemas corregidos:
--
-- 1. Zona horaria implícita: generate_series generaba slots en UTC (zona del
--    servidor Supabase) en lugar de America/Santiago. El cast ::TIMESTAMPTZ sin
--    AT TIME ZONE producía horarios desplazados 3-4h para el usuario chileno.
--
-- 2. Límite superior del generate_series usaba available_from en lugar de
--    available_until, lo que truncaba el último día de la ventana (day 28
--    aparecía sin slots).
--
-- 3. EXTRACT(ISODOW) y las comparaciones ::TIME ahora se evalúan en la hora
--    local de Santiago, no en UTC del servidor.
--
-- 4. Instructores con type = 'theory' no se filtraban: aparecían en la vista
--    y podían ser asignados a clases prácticas. Ahora se excluyen.
--    Regla: type IS NULL o type IN ('practice', 'both') → se muestran.
--           type = 'theory' → se excluyen.
--
-- 5. Un instructor podía tener múltiples filas activas en vehicle_assignments
--    (end_date IS NULL), lo que duplicaba slots en la vista. Se agrega un
--    índice único parcial para prevenir esta situación a nivel de BD.
-- ============================================================================


-- ============================================================================
-- 1. Índice único: un instructor → un vehículo activo a la vez
-- ============================================================================
-- El índice existente (idx_active_vehicle_assignment) previene que un vehículo
-- tenga dos instructores activos. Este previene el caso inverso.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_vehicle_per_instructor
  ON vehicle_assignments(instructor_id)
  WHERE end_date IS NULL;

COMMENT ON INDEX idx_one_active_vehicle_per_instructor IS
  'Garantiza que un instructor tenga como máximo un vehículo asignado activamente '
  '(end_date IS NULL). Previene duplicación de slots en v_class_b_schedule_availability.';


-- ============================================================================
-- 2. Reemplazar v_class_b_schedule_availability con zona horaria explícita
-- ============================================================================
-- DROP explícito requerido; CREATE OR REPLACE no permite cambiar columnas.
DROP VIEW IF EXISTS v_class_b_schedule_availability;

-- La vista genera todos los slots de 45 min disponibles para cada par
-- instructor + vehículo en las próximas 4 semanas (~28 días), respetando:
--   • Solo instructores activos cuyo type NO sea 'theory'
--   • Solo el vehículo actualmente asignado al instructor (end_date IS NULL)
--   • available_days del instructor evaluado en hora local Santiago
--   • available_from / available_until evaluados en hora local Santiago
--   • Sesiones ya agendadas del instructor (solapamiento real, no canceladas)
--   • Sesiones ya agendadas del vehículo (solapamiento real, no canceladas)
--
-- Zona horaria: todos los cálculos de tiempo usan AT TIME ZONE 'America/Santiago'
-- para que los horarios mostrados al usuario coincidan con la hora local chilena,
-- independientemente de la zona del servidor Supabase (UTC).
--
-- Acceso: security_invoker = true → aplica RLS del usuario que consulta.
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
SELECT s.*
FROM slots s
WHERE
  -- Sin conflicto de instructor: ninguna sesión activa se solapa con este slot
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
  -- Sin conflicto de vehículo: un vehículo no puede estar en dos clases a la vez
  AND NOT EXISTS (
    SELECT 1
    FROM class_b_sessions cb
    JOIN enrollments e ON e.id = cb.enrollment_id
    WHERE cb.vehicle_id = s.vehicle_id
      AND cb.status NOT IN ('cancelled')
      AND (e.status != 'draft' OR e.expires_at > NOW())
      AND cb.scheduled_at < s.slot_end
      AND (cb.scheduled_at + (cb.duration_min * INTERVAL '1 minute')) > s.slot_start
  );

ALTER VIEW v_class_b_schedule_availability SET (security_invoker = true);

COMMENT ON VIEW v_class_b_schedule_availability IS
  'Slots de 45 min disponibles por instructor+vehículo en las próximas 4 semanas. '
  'Zona horaria: America/Santiago explícita en generate_series, ISODOW y comparaciones TIME. '
  'Excluye instructores con type=''theory''. Solo incluye el vehículo activo del instructor. '
  'Filtra por available_days/from/until y excluye solapamientos reales con sesiones existentes. '
  'Usar con rol secretary/admin para el flujo de matrícula Clase B (RF-046).';
