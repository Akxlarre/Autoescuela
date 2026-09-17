-- Hotfix 003-i: v_class_b_schedule_availability con timeout (57014) en producción tras
-- fix-032-i. Causa raíz confirmada: el hint MATERIALIZED del CTE forzaba a Postgres a
-- calcular el conflicto de las 4.368 filas completas (28 días x instructores x vehículos)
-- ANTES de aplicar el filtro de fecha del cliente (.gte/.lt sobre slot_start), descartando
-- después ~77% de las filas ya calculadas (Rows Removed by Filter: 3373 de 4368). Bajo
-- carga real (varias peticiones concurrentes al abrir Agenda), ese exceso de trabajo superó
-- el statement_timeout de la API.
--
-- Corrección: quitar MATERIALIZED. El CTE `slot_availability` se referencia una sola vez en
-- el SELECT final, así que Postgres 12+ lo inlinea por defecto sin el hint — recupera la
-- posibilidad de aplicar el filtro de fecha antes de evaluar el NOT EXISTS de conflicto.
-- La fusión de los 2 NOT EXISTS en 1 con OR (la otra mitad de fix-032-i) se mantiene sin
-- cambios — no fue la causa del timeout y sigue siendo una mejora real.
--
-- Sin cambio de semántica de negocio: mismo WHERE, mismas columnas expuestas. No requiere
-- repetir la comparación de double-booking de fix-032-i (la condición de conflicto es
-- byte-a-byte idéntica, solo cambia si Postgres la materializa o no).

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
-- Sin MATERIALIZED (hotfix-003-i) — se referencia una sola vez abajo, Postgres la inlinea
-- por defecto, permitiendo que un filtro externo de fecha/slot_status se empuje hacia
-- adentro del cálculo en vez de forzar la evaluación completa de las 4 semanas.
slot_availability AS (
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
  'Fix-032-i: el conflicto se computa con un solo NOT EXISTS (instructor OR vehículo, antes '
  'eran 2 separados). Hotfix-003-i: SIN MATERIALIZED en el CTE (causaba timeout 57014 en '
  'producción al bloquear el pushdown del filtro de fecha del cliente) — el CTE se referencia '
  'una sola vez y Postgres lo inlinea por defecto.';
