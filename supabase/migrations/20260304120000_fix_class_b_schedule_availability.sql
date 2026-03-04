-- ============================================================================
-- CORRECCIÓN: Vista de disponibilidad Clase B y duración de sesiones prácticas
-- ============================================================================
-- Problema 1: duration_min DEFAULT 90 en class_b_sessions era incorrecto.
--             Las clases prácticas Clase B duran 45 minutos.
--             NOTA: class_b_theory_sessions mantiene DEFAULT 90 (sesiones Zoom).
--
-- Problema 2: v_class_b_schedule_availability tenía 3 bugs críticos:
--   a) NOT EXISTS verificaba si existía CUALQUIER sesión del instructor+vehículo
--      en lugar de comprobar solapamiento horario real (slot a slot).
--   b) Slots generados cada 1 hora en lugar de cada 45 minutos.
--   c) Ventana de solo 14 días en lugar de 28 (~4 semanas).
--   d) No filtraba por available_days, available_from ni available_until del instructor.
--   e) No verificaba conflictos de vehículo independientemente del instructor.
-- ============================================================================


-- ============================================================================
-- 1. Corregir DEFAULT de duración en sesiones prácticas Clase B
-- ============================================================================
ALTER TABLE class_b_sessions
  ALTER COLUMN duration_min SET DEFAULT 45;

COMMENT ON COLUMN class_b_sessions.duration_min IS
  'Duración de la sesión práctica en minutos (default 45). Usado para cálculo de solapamiento en agenda.';


-- ============================================================================
-- 2. Reemplazar v_class_b_schedule_availability
-- ============================================================================
-- DROP explícito necesario porque CREATE OR REPLACE no puede renombrar columnas
-- (la versión anterior tenía la columna "slot"; ahora se llama "slot_start").
DROP VIEW IF EXISTS v_class_b_schedule_availability;
-- La vista genera todos los slots de 45 min disponibles para cada par
-- instructor + vehículo en las próximas 4 semanas (~28 días), respetando:
--   • available_days del instructor (ej. [1,2,3,4,5] = Lun-Vie)
--   • available_from / available_until del instructor
--   • Sesiones ya agendadas del instructor (no canceladas)
--   • Sesiones ya agendadas del vehículo (no canceladas)
--
-- Acceso: security_invoker = true → aplica RLS del usuario que consulta.
--   • Secretary/Admin : ven todos los instructores y vehículos de su sede → OK
--   • Instructor      : ve solo su propia disponibilidad → OK
--   • Student         : no puede ver instructors/vehicles con sus policies
--                       actuales; si se requiere self-service, crear un RPC
--                       SECURITY DEFINER específico para matrícula online.
-- ============================================================================
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
  -- Generar todos los posibles slots de 45 min en las próximas 4 semanas
  CROSS JOIN LATERAL generate_series(
    (CURRENT_DATE + i.available_from)::TIMESTAMPTZ,
    ((CURRENT_DATE + INTERVAL '28 days')::DATE + i.available_from)::TIMESTAMPTZ,
    INTERVAL '45 minutes'
  ) AS gs
  WHERE
    i.active = true
    -- Solo en los días hábiles del instructor (ISODOW: 1=Lun … 7=Dom)
    AND EXTRACT(ISODOW FROM gs)::INT = ANY(i.available_days)
    -- El slot debe iniciarse dentro de la ventana horaria del instructor
    AND gs::TIME >= i.available_from
    -- El slot completo (45 min) debe terminar dentro de la ventana horaria
    AND (gs + INTERVAL '45 minutes')::TIME <= i.available_until
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
      -- Solapamiento real: [cb_start, cb_end) ∩ [slot_start, slot_end) ≠ ∅
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
  'Filtra por available_days/from/until y excluye solapamientos reales con sesiones existentes. '
  'Usar con rol secretary/admin para el flujo de matrícula Clase B (RF-046).';
