-- Fix 032-i: v_class_b_schedule_availability tarda 1-4.5s por carga real (Horario/Agenda).
-- EXPLAIN ANALYZE confirmó 1.033.204 buffer hits para devolver 3.348 filas, con 4 SubPlans
-- casi idénticos. Causa raíz: slot_status es una columna CASE con 2 NOT EXISTS
-- correlacionados; como no es una columna real, Postgres no cachea el resultado y termina
-- evaluando la misma lógica DOS veces por fila cuando el cliente filtra con
-- .eq('slot_status', 'available') — una vez como filtro interno, otra para la columna de
-- salida (2 refs x 2 NOT EXISTS = 4 subplanes).
--
-- Esta migración NO cambia la semántica de qué cuenta como "conflicto" (branch scoping,
-- both_branches, exclusión de 'cancelled'/drafts vencidos, etc. — ver ASG-i-007 y
-- fix-032-i, sección "Fuera de alcance"). Dos optimizaciones puramente de forma:
--
--   1. Los 2 NOT EXISTS (conflicto de instructor / conflicto de vehículo) se fusionan en
--      UNO solo con OR: NOT (A OR B) == NOT A AND NOT B, misma lógica, la mitad de
--      subqueries correlacionadas por fila.
--   2. El cálculo de disponibilidad se aisla en un CTE `MATERIALIZED`, forzando a
--      Postgres a resolverlo una sola vez por fila sin importar cuántas veces la query
--      del cliente referencie `slot_status` (WHERE y/o SELECT) — elimina la duplicación
--      que explicaba los 4 SubPlans.
--
-- Referencia de la definición anterior: 20260730100000_instructors_vehicles_both_branches.sql:148
-- Referencia del trigger de doble-booking a nivel de escritura (protección independiente,
-- no tocada por este fix): 20260811110000_fix152_class_b_sessions_prevent_double_booking.sql

DROP VIEW IF EXISTS v_class_b_schedule_availability;

CREATE OR REPLACE VIEW v_class_b_schedule_availability AS
WITH
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
  JOIN course_slots cs
    ON cs.branch_id = u.branch_id OR i.both_branches
  JOIN vehicles v
    ON v.id = va.vehicle_id
   AND (v.branch_id = cs.branch_id OR v.both_branches)
  CROSS JOIN LATERAL generate_series(
    CURRENT_DATE::TIMESTAMP,
    (CURRENT_DATE + INTERVAL '28 days')::TIMESTAMP,
    INTERVAL '1 day'
  ) AS d
  WHERE
    i.active = true
    AND (i.type IS NULL OR i.type != 'theory')
    AND EXTRACT(ISODOW FROM d)::INT = ANY(cs.schedule_days)
),
-- MATERIALIZED: fuerza a Postgres a resolver el conflicto una sola vez por fila de `slots`,
-- sin importar que la query del cliente termine referenciando `slot_status` tanto en WHERE
-- (.eq('slot_status', 'available')) como en el SELECT — sin este hint, Postgres 12+ puede
-- inlinear el CTE y re-evaluar el NOT EXISTS por cada referencia.
slot_availability AS MATERIALIZED (
  SELECT
    s.*,
    NOT EXISTS (
      SELECT 1
      FROM class_b_sessions cb
      JOIN enrollments e ON e.id = cb.enrollment_id
      WHERE (cb.instructor_id = s.instructor_id OR cb.vehicle_id = s.vehicle_id)
        AND cb.status NOT IN ('cancelled')
        AND (e.status != 'draft' OR e.expires_at > NOW())
        AND cb.scheduled_at < s.slot_end
        AND (cb.scheduled_at + (cb.duration_min * INTERVAL '1 minute')) > s.slot_start
    ) AS is_available
  FROM slots s
)
SELECT
  instructor_id,
  vehicle_id,
  slot_start,
  slot_end,
  CASE WHEN is_available THEN 'available' ELSE 'occupied' END AS slot_status
FROM slot_availability;

ALTER VIEW v_class_b_schedule_availability SET (security_invoker = true);

COMMENT ON VIEW v_class_b_schedule_availability IS
  'Slots de 45 min (disponibles Y ocupados) por instructor+vehículo en las próximas 4 semanas. '
  'Columna slot_status = ''available'' | ''occupied'' indica disponibilidad real. '
  'Zona horaria: America/Santiago explícita. '
  'Spec 0004-m: un instructor con both_branches=true genera filas para las dos sedes '
  '(join de course_slots ya no ancla solo a su sede); el vehículo asignado debe cubrir '
  'la sede del slot (v.branch_id = cs.branch_id OR v.both_branches) — si el vehículo del '
  'instructor no es both_branches, la sede que no cubre queda sin filas (no "occupied", '
  'ausente). El conflicto de instructor/vehículo es global, sin filtro de sede: un '
  'instructor u vehículo ocupado en una sede ya bloquea el mismo horario en la otra. '
  'Excluye instructores con type=''theory''. Solo incluye el vehículo activo del instructor. '
  'Fix-032-i: el conflicto se computa en un CTE MATERIALIZED con un solo NOT EXISTS '
  '(instructor OR vehículo, antes eran 2 NOT EXISTS separados evaluados 2 veces por fila '
  'por la duplicación WHERE/SELECT de slot_status) — misma semántica, ~4x menos subplanes.';
