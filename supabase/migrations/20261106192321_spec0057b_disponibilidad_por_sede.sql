-- Spec 0057-b: la disponibilidad de Clase B dice de qué sede es cada bloque (F08 de fix-186-b).
--
-- La vista ya arma los bloques por sede (el JOIN vehicles exige que el vehículo cubra la sede del
-- curso), pero no exponía esa sede y los consumidores filtran solo por instructor: un instructor
-- "Ambas" con vehículo de la sede 1 ofrecía en la sede 2 los bloques de la sede 1.
--
-- Copia de la vista de 20261019120000_spec0052_feriados.sql. Cambios: slots suma cs.branch_id y
-- el SELECT final agrega branch_ids (arreglo, una fila por bloque como exige fix-227-b).
-- Rollback: re-aplicar la definición de 20261019120000 (sin la columna; hay que hacer DROP VIEW
-- antes, porque CREATE OR REPLACE no quita columnas). Idempotente (CREATE OR REPLACE).

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
    cs.branch_id,  -- spec 0057-b: la sede del curso del que sale el bloque
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
    -- spec 0052-b: un feriado no ofrece horarios.
    AND NOT EXISTS (SELECT 1 FROM public.holidays h WHERE h.date = days.d)
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
-- Spec 0057-b: GROUP BY en vez de DISTINCT, para juntar en branch_ids las sedes que puede
-- atender el bloque. slot_status no depende de la sede (el choque es global, fix-196-b), así
-- que agrupar por él no parte filas. instructor_id y slot_start siguen en el GROUP BY: el
-- filtro del cliente se sigue empujando adentro (hotfix-003-i).
-- Se agrupa por las columnas de salida (GROUP BY 1..5), no por is_available: agrupando por
-- is_available, armar slot_status re-evaluaba class_b_slot_occupied() por fila (+40 % en la
-- consulta del admin a 28 días). Así cuesta lo mismo que el DISTINCT (medido 2026-11-06).
-- CREATE OR REPLACE VIEW solo permite agregar columnas al final: branch_ids va última.
SELECT
  instructor_id,
  vehicle_id,
  slot_start,
  slot_end,
  CASE WHEN is_available THEN 'available' ELSE 'occupied' END AS slot_status,
  array_agg(DISTINCT branch_id ORDER BY branch_id) AS branch_ids
FROM slot_availability
GROUP BY 1, 2, 3, 4, 5;

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
  'empezaron. Spec 0052-b: no genera bloques en fechas de public.holidays. '
  'Spec 0057-b: branch_ids = las sedes que puede atender el bloque (la de cada curso del que sale, '
  'si el vehículo la cubre). Los consumidores filtran con branch_ids @> ARRAY[sede]: un '
  'instructor "Ambas" con vehículo de una sola sede no ofrece bloques en la otra.';
