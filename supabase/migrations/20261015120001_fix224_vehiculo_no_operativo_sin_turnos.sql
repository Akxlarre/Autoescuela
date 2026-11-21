-- fix-224-b: un vehículo en Mantenimiento o Fuera de servicio deja de ofrecer horarios.
--
-- v_class_b_schedule_availability no miraba vehicles.status: el instructor con un vehículo en
-- mantenimiento seguía ofreciendo turnos en la matrícula, la Agenda, la ficha del alumno y el
-- pago online (todos leen esta vista). Decisión del owner 2026-10-12.
--
-- vehicle_is_operational(text) es espejo de isVehicleOperational() en
-- core/utils/vehicle-status.utils.ts: no operativo = maintenance, mantenimiento, out_of_service,
-- blocked (sin distinguir mayúsculas). Cualquier otro valor (operational, available, NULL…) sí.
--
-- La vista es copia de la vigente (20261009121000) + el filtro en el join de vehicles.
-- Las clases ya agendadas con ese vehículo no se tocan.
-- Idempotente (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.vehicle_is_operational(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(lower(p_status), '') NOT IN ('maintenance', 'mantenimiento', 'out_of_service', 'blocked');
$$;

COMMENT ON FUNCTION public.vehicle_is_operational(text) IS
  'fix-224-b: false si el vehículo está en Mantenimiento o Fuera de servicio (espejo de isVehicleOperational en la app).';

CREATE OR REPLACE VIEW public.v_class_b_schedule_availability AS
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
    (days.d + cs.slot_from) AT TIME ZONE 'America/Santiago' AS slot_start,
    (days.d + cs.slot_to)   AT TIME ZONE 'America/Santiago' AS slot_end
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
   AND public.vehicle_is_operational(v.status)
  CROSS JOIN LATERAL (
    SELECT (SELECT public.chile_today()) + n AS d
    FROM generate_series(0, 28) AS n
  ) AS days
  WHERE
    i.active = true
    AND (i.type IS NULL OR i.type != 'theory')
    AND EXTRACT(ISODOW FROM days.d)::INT = ANY(cs.schedule_days)
),
-- Sin MATERIALIZED (hotfix-003-i). El choque, en la función SECURITY DEFINER (fix-196-b).
slot_availability AS (
  SELECT
    s.*,
    NOT public.class_b_slot_occupied(s.instructor_id, s.vehicle_id, s.slot_start, s.slot_end)
      AS is_available
  FROM slots s
)
SELECT
  instructor_id,
  vehicle_id,
  slot_start,
  slot_end,
  CASE WHEN is_available THEN 'available' ELSE 'occupied' END AS slot_status
FROM slot_availability;

ALTER VIEW public.v_class_b_schedule_availability SET (security_invoker = true);

COMMENT ON VIEW public.v_class_b_schedule_availability IS
  'Slots de 45 min (disponibles Y ocupados) por instructor+vehículo en las próximas 4 semanas. '
  'Columna slot_status = ''available'' | ''occupied'' indica disponibilidad real. '
  'Zona horaria: America/Santiago explícita; spec 0024-m: los días parten de chile_today(), no '
  'del día UTC de la sesión. '
  'Spec 0004-m: un instructor con both_branches=true genera filas para las dos sedes '
  '(join de course_slots ya no ancla solo a su sede); el vehículo asignado debe cubrir '
  'la sede del slot (v.branch_id = cs.branch_id OR v.both_branches) — si el vehículo del '
  'instructor no es both_branches, la sede que no cubre queda sin filas (no "occupied", '
  'ausente). El conflicto de instructor/vehículo es global, sin filtro de sede: un '
  'instructor u vehículo ocupado en una sede ya bloquea el mismo horario en la otra. '
  'Excluye instructores con type=''theory''. Solo incluye el vehículo activo del instructor. '
  'Fix-032-i: el conflicto se computa con un solo chequeo (instructor OR vehículo). '
  'Hotfix-003-i: SIN MATERIALIZED en el CTE (causaba timeout 57014 al bloquear el pushdown del '
  'filtro de fecha). Fix-196-b: el conflicto se calcula en class_b_slot_occupied() SECURITY '
  'DEFINER — con security_invoker la RLS se evaluaba fila por fila (~5 s por semana) y ocultaba '
  'las clases de la otra sede. '
  'Fix-224-b: un vehículo en Mantenimiento o Fuera de servicio (vehicle_is_operational) no '
  'genera filas.';
