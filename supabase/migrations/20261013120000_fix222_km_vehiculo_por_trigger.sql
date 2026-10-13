-- fix-222-b: el kilometraje del vehículo lo mantiene la BD, no la app.
--
-- Antes la app hacía `UPDATE vehicles SET current_km = <km final>` al finalizar una clase:
--   · con la sesión de una secretaria, la RLS lo filtraba para vehículos "Ambas" o de otra sede
--     y el km no se actualizaba (S2);
--   · el valor se pisaba sin mirar el anterior, así que un km mal tipeado hacía retroceder el
--     odómetro del vehículo (S3);
--   · registrar un mantenimiento no tocaba el vehículo (S6).
--
-- Ahora dos triggers SECURITY DEFINER lo hacen, sin depender de quién escribe:
--   1. class_b_sessions.km_end → vehicles.current_km, solo si es MAYOR al registrado.
--   2. maintenance_records completado → vehicles.current_km (si es mayor) y vehicles.last_maintenance
--      (si la fecha es posterior a la registrada y no es futura).
--
-- El admin sigue corrigiendo el km a mano desde Editar vehículo (UPDATE directo, sin cambios).
-- Idempotente (CREATE OR REPLACE + DROP TRIGGER IF EXISTS).

-- ── 1. Clases ────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_vehicle_km_from_class()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.vehicle_id IS NOT NULL AND NEW.km_end IS NOT NULL THEN
    UPDATE public.vehicles
       SET current_km = NEW.km_end
     WHERE id = NEW.vehicle_id
       AND COALESCE(current_km, 0) < NEW.km_end;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_vehicle_km_from_class() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.sync_vehicle_km_from_class() IS
  'fix-222-b: al registrar el km final de una clase, sube vehicles.current_km (nunca lo baja).';

DROP TRIGGER IF EXISTS trg_sync_vehicle_km_from_class ON public.class_b_sessions;
CREATE TRIGGER trg_sync_vehicle_km_from_class
  AFTER INSERT OR UPDATE OF km_end ON public.class_b_sessions
  FOR EACH ROW
  WHEN (NEW.km_end IS NOT NULL)
  EXECUTE FUNCTION public.sync_vehicle_km_from_class();

-- ── 2. Mantenimientos ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_vehicle_from_maintenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_date date := COALESCE(NEW.completed_date, NEW.scheduled_date);
BEGIN
  -- Solo un mantenimiento ya hecho mueve los datos del vehículo.
  IF NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NULL;
  END IF;

  UPDATE public.vehicles v
     SET current_km = CASE
           WHEN NEW.km_at_time IS NOT NULL AND NEW.km_at_time > COALESCE(v.current_km, 0)
             THEN NEW.km_at_time
           ELSE v.current_km
         END,
         last_maintenance = CASE
           WHEN v_date IS NOT NULL AND v_date <= public.chile_today()
                AND (v.last_maintenance IS NULL OR v_date > v.last_maintenance)
             THEN v_date
           ELSE v.last_maintenance
         END
   WHERE v.id = NEW.vehicle_id
     AND (
       (NEW.km_at_time IS NOT NULL AND NEW.km_at_time > COALESCE(v.current_km, 0))
       OR (v_date IS NOT NULL AND v_date <= public.chile_today()
           AND (v.last_maintenance IS NULL OR v_date > v.last_maintenance))
     );
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_vehicle_from_maintenance() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.sync_vehicle_from_maintenance() IS
  'fix-222-b: un mantenimiento completado sube vehicles.current_km (si su km es mayor) y actualiza last_maintenance (si su fecha es posterior y no futura).';

DROP TRIGGER IF EXISTS trg_sync_vehicle_from_maintenance ON public.maintenance_records;
CREATE TRIGGER trg_sync_vehicle_from_maintenance
  AFTER INSERT OR UPDATE OF km_at_time, completed_date, scheduled_date, status
  ON public.maintenance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_vehicle_from_maintenance();
