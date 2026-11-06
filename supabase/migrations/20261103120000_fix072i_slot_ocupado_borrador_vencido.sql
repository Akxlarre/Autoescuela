-- fix-072-i: la vista de disponibilidad cuenta las clases de un borrador vencido.
-- class_b_slot_occupied() las ignoraba, pero los triggers de choque del instructor (fix-152/163) y
-- del vehículo (fix-187) sí las cuentan: el horario se veía libre y al guardar fallaba. Ahora
-- cuentan lo mismo. Se quita el JOIN a enrollments, que solo servía para ese filtro.
-- CREATE OR REPLACE conserva los permisos de fix-196-b.

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
    WHERE (cb.instructor_id = p_instructor_id OR cb.vehicle_id = p_vehicle_id)
      AND cb.status NOT IN ('cancelled')
      AND cb.scheduled_at < p_slot_end
      AND (cb.scheduled_at + (cb.duration_min * INTERVAL '1 minute')) > p_slot_start
  );
$$;

COMMENT ON FUNCTION public.class_b_slot_occupied(integer, integer, timestamptz, timestamptz) IS
  'fix-072-i: true si el instructor o el vehículo tienen una clase no cancelada que se cruza con el '
  'turno. Cuenta igual que los triggers de choque: una clase de un borrador vencido ocupa el horario '
  'hasta que se borra o se cancela. SECURITY DEFINER a propósito (fix-196-b): el choque es global '
  'entre sedes y evaluar la RLS por fila costaba ~5 s por semana de Agenda. Solo devuelve un booleano.';
