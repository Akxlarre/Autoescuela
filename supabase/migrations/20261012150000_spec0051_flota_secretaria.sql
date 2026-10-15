-- spec 0051-b: Flota para la secretaria, limitada a su sede.
--
-- Antes: la secretaria podía crear y editar vehículos de su sede (no "Ambas"), pero documentos y
-- mantenimientos eran solo del admin. Ahora puede cargar documentos y registrar mantenimientos de
-- los vehículos que opera, con una sola regla:
--
--   | Quién                            | Opera                                   |
--   |----------------------------------|-----------------------------------------|
--   | admin                            | todo                                    |
--   | secretaria con grant multi-sede  | todo                                    |
--   | secretaria sin grant             | vehículos de su sede que no son "Ambas" |
--   | otro rol                         | nada                                    |
--
-- La misma tabla vive en la app en core/utils/vehicle-permissions.utils.ts (canManageVehicle).
-- SELECT y DELETE no cambian (leer sigue abierto al personal; borrar sigue siendo solo del admin).
-- Storage no cambia: el bucket `documents` ya permite a la secretaria la carpeta `vehicle-docs`.
-- Idempotente (CREATE OR REPLACE + DROP POLICY IF EXISTS).

CREATE OR REPLACE FUNCTION public.auth_can_manage_vehicle(p_vehicle_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE public.auth_user_role()
    WHEN 'admin' THEN true
    WHEN 'secretary' THEN
      public.auth_can_access_both_branches()
      OR EXISTS (
        SELECT 1
          FROM public.vehicles v
         WHERE v.id = p_vehicle_id
           AND v.branch_id = public.auth_user_branch_id()
           AND NOT v.both_branches
      )
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.auth_can_manage_vehicle(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_can_manage_vehicle(integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.auth_can_manage_vehicle(integer) IS
  'spec 0051-b: admin y secretaria con grant multi-sede operan cualquier vehículo; secretaria sin grant, solo los de su sede que no son "Ambas".';

-- ── vehicle_documents ────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS insert_vehicle_documents ON public.vehicle_documents;
CREATE POLICY insert_vehicle_documents ON public.vehicle_documents
  FOR INSERT
  WITH CHECK (public.auth_can_manage_vehicle(vehicle_id));

DROP POLICY IF EXISTS update_vehicle_documents ON public.vehicle_documents;
CREATE POLICY update_vehicle_documents ON public.vehicle_documents
  FOR UPDATE
  USING (public.auth_can_manage_vehicle(vehicle_id))
  WITH CHECK (public.auth_can_manage_vehicle(vehicle_id));

-- ── maintenance_records ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS insert_maintenance_records ON public.maintenance_records;
CREATE POLICY insert_maintenance_records ON public.maintenance_records
  FOR INSERT
  WITH CHECK (public.auth_can_manage_vehicle(vehicle_id));

DROP POLICY IF EXISTS update_maintenance_records ON public.maintenance_records;
CREATE POLICY update_maintenance_records ON public.maintenance_records
  FOR UPDATE
  USING (public.auth_can_manage_vehicle(vehicle_id))
  WITH CHECK (public.auth_can_manage_vehicle(vehicle_id));

-- ── vehicles ─────────────────────────────────────────────────────────────────────────────────
-- La rama de la secretaria suma el grant multi-sede. La del instructor (UPDATE del km de un
-- vehículo de sus clases) queda exactamente igual.
DROP POLICY IF EXISTS insert_vehicles ON public.vehicles;
CREATE POLICY insert_vehicles ON public.vehicles
  FOR INSERT
  WITH CHECK (
    public.auth_user_role() = 'admin'
    OR (
      public.auth_user_role() = 'secretary'
      AND (
        public.auth_can_access_both_branches()
        OR (branch_id = public.auth_user_branch_id() AND both_branches = false)
      )
    )
  );

DROP POLICY IF EXISTS update_vehicles ON public.vehicles;
CREATE POLICY update_vehicles ON public.vehicles
  FOR UPDATE
  USING (
    public.auth_user_role() = 'admin'
    OR (
      public.auth_user_role() = 'secretary'
      AND (
        public.auth_can_access_both_branches()
        OR (branch_id = public.auth_user_branch_id() AND both_branches = false)
      )
    )
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
    public.auth_user_role() = 'admin'
    OR (
      public.auth_user_role() = 'secretary'
      AND (
        public.auth_can_access_both_branches()
        OR (branch_id = public.auth_user_branch_id() AND both_branches = false)
      )
    )
    OR EXISTS (
      SELECT 1
        FROM public.class_b_sessions cb
        JOIN public.instructors i ON i.id = cb.instructor_id
        JOIN public.users u ON u.id = i.user_id
       WHERE cb.vehicle_id = vehicles.id
         AND u.supabase_uid = auth.uid()
    )
  );
