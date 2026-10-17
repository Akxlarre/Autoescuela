-- fix-228-b: la vista de horarios cubre el plazo de la Agenda y no ofrece bloques ya pasados.
--
-- S2 (fix-186-b): generaba los bloques desde el inicio del día; a las 10:00 seguía ofreciendo el
-- de las 08:30. Ahora solo bloques que todavía no empiezan.
-- S3 (fix-186-b): generaba 28 días y la Agenda deja navegar 2, 3 o 4 meses; desde la semana 5 no
-- había "Disponible". Ahora hasta hoy + 4 meses (el máximo de AgendaSettingsService).
-- Decisiones del owner 2026-10-16. Tiempo medido en producción: una semana 140–250 ms, el plazo
-- completo de un instructor 15–90 ms.
--
-- Copia de la vista de fix-227-b (20261016140000) + esos dos cambios. Idempotente.

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
    FROM generate_series(
      0,
      ((SELECT public.chile_today()) + interval '4 months')::date - (SELECT public.chile_today())
    ) AS n
  ) AS days
  WHERE
    i.active = true
    AND (i.type IS NULL OR i.type != 'theory')
    AND EXTRACT(ISODOW FROM days.d)::INT = ANY(cs.schedule_days)
    AND ((days.d + cs.slot_from) AT TIME ZONE 'America/Santiago') > now()
),
-- Sin MATERIALIZED (hotfix-003-i). El choque, en la función SECURITY DEFINER (fix-196-b).
slot_availability AS (
  SELECT
    s.*,
    NOT public.class_b_slot_occupied(s.instructor_id, s.vehicle_id, s.slot_start, s.slot_end)
      AS is_available
  FROM slots s
)
-- fix-227-b: un instructor "Ambas" recibe el mismo bloque desde las dos sedes; una sola fila.
SELECT DISTINCT
  instructor_id,
  vehicle_id,
  slot_start,
  slot_end,
  CASE WHEN is_available THEN 'available' ELSE 'occupied' END AS slot_status
FROM slot_availability;

ALTER VIEW public.v_class_b_schedule_availability SET (security_invoker = true);

COMMENT ON VIEW public.v_class_b_schedule_availability IS
  'Slots de 45 min (disponibles Y ocupados) por instructor+vehículo hasta hoy + 4 meses. '
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
  'genera filas. Fix-227-b: SELECT DISTINCT — un instructor "Ambas" no duplica el bloque. '
  'Fix-228-b: cubre hasta hoy + 4 meses (el máximo de la Agenda) y no ofrece bloques que ya '
  'empezaron.';
