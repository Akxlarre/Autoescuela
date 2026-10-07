-- fix-196-b: la Agenda tarda 5–6 s — v_class_b_schedule_availability evalúa la RLS fila por fila.
--
-- La vista es security_invoker (hotfix-003-i). Para cada turno generado, el NOT EXISTS de
-- choques leía class_b_sessions/enrollments con la RLS de quien consulta: la política se evalúa
-- por fila (auth_user_role() + subconsultas) y la condición corre dos veces (filtro de
-- slot_status + CASE). EXPLAIN ANALYZE impersonando: secretaria/semana 4,99 s, admin/semana
-- 4,99 s, admin/28 días 21,2 s (como superusuario, 0,2 s).
--
-- Además rompía la intención documentada de la vista ("el conflicto de instructor/vehículo es
-- global, sin filtro de sede"): la secretaria no ve las clases de la otra sede, así que un
-- instructor/vehículo compartido ocupado allá se le mostraba disponible.
--
-- Corrección: el choque se calcula en una función SECURITY DEFINER que solo devuelve un
-- booleano. El resto de la vista es idéntico y sigue security_invoker: qué turnos se generan
-- (instructores, vehículos, asignaciones, cursos) sigue respetando la RLS del usuario.
-- Sin MATERIALIZED (hotfix-003-i): el filtro de fecha del cliente se sigue empujando adentro.
-- Medido en una transacción revertida: secretaria/semana 0,12 s, admin/semana 0,20 s,
-- admin/28 días 0,81 s, con las mismas filas.

CREATE OR REPLACE FUNCTION public.class_b_slot_occupied(
  p_instructor_id integer,
  p_vehicle_id    integer,
  p_slot_start    timestamptz,
  p_slot_end      timestamptz
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_b_sessions cb
    JOIN public.enrollments e ON e.id = cb.enrollment_id
    WHERE (cb.instructor_id = p_instructor_id OR cb.vehicle_id = p_vehicle_id)
      AND cb.status NOT IN ('cancelled')
      AND (e.status <> 'draft' OR e.expires_at > now())
      AND cb.scheduled_at < p_slot_end
      AND (cb.scheduled_at + (cb.duration_min * INTERVAL '1 minute')) > p_slot_start
  );
$$;

COMMENT ON FUNCTION public.class_b_slot_occupied(integer, integer, timestamptz, timestamptz) IS
  'fix-196-b: true si el instructor o el vehículo tienen una clase (no cancelada, de una matrícula '
  'no-borrador o borrador vigente) que se cruza con el turno. SECURITY DEFINER a propósito: el '
  'choque es global entre sedes y evaluar la RLS por fila costaba ~5 s por semana de Agenda. '
  'Solo devuelve un booleano.';

-- EXECUTE se concede a PUBLIC por defecto: sin sesión no se usa (lección de fix-191-b).
REVOKE ALL ON FUNCTION public.class_b_slot_occupied(integer, integer, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_b_slot_occupied(integer, integer, timestamptz, timestamptz) TO authenticated, service_role;

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
  'Zona horaria: America/Santiago explícita. '
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
  'las clases de la otra sede.';
