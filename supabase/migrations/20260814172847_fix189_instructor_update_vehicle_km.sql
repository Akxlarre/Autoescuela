-- ============================================================
-- Fix-189-m: Finalizar clase no actualiza vehicles.current_km
--
-- Problema: InstructorClasesFacade.finishClass() guardaba km_end en class_b_sessions
-- pero nunca propagaba el valor a vehicles.current_km. Aunque el facade lo hiciera,
-- update_vehicles (20260730100000) solo permite admin/secretary — instructor no puede
-- escribir en vehicles bajo ninguna circunstancia.
--
-- Solucion:
--   1. update_vehicles: agregar instructor, acotado a vehiculos con una class_b_sessions
--      asignada a ese instructor (subquery directa, mismo patron que fix-188 para evitar
--      helpers SECURITY DEFINER dentro de un contexto RLS anidado).
--   2. Trigger BEFORE UPDATE: si quien escribe es instructor, rechaza el UPDATE si
--      cualquier columna distinta de current_km cambio — el permiso nuevo no debe poder
--      usarse para tocar patente/estado/sede/etc. del vehiculo.
-- ============================================================

CREATE OR REPLACE FUNCTION public.restrict_instructor_vehicle_update()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.supabase_uid = auth.uid()
      AND r.name = 'instructor'
  ) THEN
    IF NEW.license_plate    IS DISTINCT FROM OLD.license_plate
       OR NEW.brand            IS DISTINCT FROM OLD.brand
       OR NEW.model            IS DISTINCT FROM OLD.model
       OR NEW.year             IS DISTINCT FROM OLD.year
       OR NEW.body_type        IS DISTINCT FROM OLD.body_type
       OR NEW.transmission     IS DISTINCT FROM OLD.transmission
       OR NEW.branch_id        IS DISTINCT FROM OLD.branch_id
       OR NEW.status           IS DISTINCT FROM OLD.status
       OR NEW.last_inspection  IS DISTINCT FROM OLD.last_inspection
       OR NEW.last_maintenance IS DISTINCT FROM OLD.last_maintenance
       OR NEW.both_branches    IS DISTINCT FROM OLD.both_branches
    THEN
      RAISE EXCEPTION 'El instructor solo puede actualizar el kilometraje (current_km) del vehiculo';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_restrict_instructor_vehicle_update ON public.vehicles;
CREATE TRIGGER trg_restrict_instructor_vehicle_update
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_instructor_vehicle_update();

DROP POLICY IF EXISTS update_vehicles ON vehicles;
CREATE POLICY update_vehicles ON vehicles
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND branch_id = auth_user_branch_id()
        AND both_branches = false)
    OR EXISTS (
      SELECT 1
      FROM public.class_b_sessions cb
      JOIN public.instructors i ON i.id = cb.instructor_id
      JOIN public.users u ON u.id = i.user_id
      WHERE cb.vehicle_id = vehicles.id
        AND u.supabase_uid = auth.uid()
    )
  )
  WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND branch_id = auth_user_branch_id()
        AND both_branches = false)
    OR EXISTS (
      SELECT 1
      FROM public.class_b_sessions cb
      JOIN public.instructors i ON i.id = cb.instructor_id
      JOIN public.users u ON u.id = i.user_id
      WHERE cb.vehicle_id = vehicles.id
        AND u.supabase_uid = auth.uid()
    )
  );
