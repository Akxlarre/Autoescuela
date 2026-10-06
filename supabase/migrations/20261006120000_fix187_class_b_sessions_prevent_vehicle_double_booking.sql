-- Fix 187-b: doble-agendado del mismo VEHÍCULO sin constraint en BD (S4 de ASG-i-026).
-- El Triple Match se cumplía en la BD para el instructor (trg_prevent_double_booking, fix-152-m)
-- y el alumno (trg_prevent_student_double_booking, fix-301-m), pero no para el vehículo: una clase
-- de otro instructor con el mismo vehículo a la misma hora se guardaba, y "Iniciar clase" podía
-- cambiar a un vehículo ocupado. La vista de disponibilidad lo filtra solo AL LEER.
--
-- Mismo patrón que fix-301-m:
--   · 'cancelled' y 'no_show' no ocupan el vehículo (la clase no ocurrió).
--   · Un UPDATE que no mueve la clase ni cambia su vehículo ni la reactiva no se valida: en la BD
--     hay choques históricos (clases completed/no_show del seed) que deben poder cerrarse o
--     cancelarse sin quedar bloqueadas.
--
-- SECURITY DEFINER: la búsqueda del choque debe ver las clases de TODAS las sedes (vehículos
-- "ambas sedes"); con la RLS por sede (0047-b), una secretaria no vería las de la otra sede.
--
-- Lock transaccional por vehículo: sin él, dos inserciones casi simultáneas pasan ambas el
-- EXISTS (ninguna ve la fila aún no confirmada de la otra). Con el lock, la segunda espera a que
-- la primera termine y entonces sí la ve.

CREATE OR REPLACE FUNCTION public.prevent_vehicle_double_booking_class_b_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''   -- DG-063: tablas calificadas con public.
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'no_show') OR NEW.scheduled_at IS NULL OR NEW.vehicle_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.vehicle_id IS NOT DISTINCT FROM OLD.vehicle_id
     AND NEW.scheduled_at IS NOT DISTINCT FROM OLD.scheduled_at
     AND NEW.duration_min IS NOT DISTINCT FROM OLD.duration_min
     AND OLD.status NOT IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- 1870 = espacio de claves de este trigger (fix-187); el segundo entero es el vehículo.
  PERFORM pg_advisory_xact_lock(1870, NEW.vehicle_id);

  IF EXISTS (
    SELECT 1
    FROM public.class_b_sessions cb
    WHERE cb.vehicle_id = NEW.vehicle_id
      AND cb.id IS DISTINCT FROM NEW.id
      AND cb.status NOT IN ('cancelled', 'no_show')
      AND cb.scheduled_at IS NOT NULL
      AND NEW.scheduled_at < (cb.scheduled_at + (COALESCE(cb.duration_min, 45) * INTERVAL '1 minute'))
      AND cb.scheduled_at < (NEW.scheduled_at + (COALESCE(NEW.duration_min, 45) * INTERVAL '1 minute'))
  ) THEN
    RAISE EXCEPTION 'El vehículo ya tiene una clase agendada que se solapa con este horario.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_vehicle_double_booking ON public.class_b_sessions;

CREATE TRIGGER trg_prevent_vehicle_double_booking
  BEFORE INSERT OR UPDATE OF vehicle_id, scheduled_at, duration_min, status
  ON public.class_b_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_vehicle_double_booking_class_b_sessions();
