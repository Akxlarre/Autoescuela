-- ============================================================================
-- fix-179-b: users — la secretaria solo edita alumnos y no toca columnas de acceso
-- ============================================================================
-- Contexto (ASG-i-043, confirmado contra pg_policies remoto el 2026-10-01):
--   update_users (secretaria) = branch_visible(branch_id) AND role_id <> admin.
-- Con eso, una secretaria podía editar desde la consola a OTRAS secretarias e instructores de su
-- sede (email, active, role_id a cualquier rol no-admin) y escribir can_access_both_branches o
-- supabase_uid en cualquier fila visible. Encadenado con activate-instructor-account (que valida
-- el email contra users.email), cambiar el email de un instructor no activado alcanzaba para
-- recibir su link de acceso.
--
-- Los flujos legítimos de la secretaria sobre users (matrícula, cursos singulares, pre-inscritos)
-- solo escriben filas de alumnos o de usuarios aún sin rol, y como mucho les asignan el rol
-- alumno. Las columnas de acceso las escriben Edge Functions con service role.
--
-- 1. update_users: la secretaria solo actualiza filas con role_id NULL o alumno. Sin WITH CHECK
--    explícito, Postgres aplica el USING también a la fila nueva → tampoco puede promover a nadie.
-- 2. Trigger users_guard_secretary_write: con sesión de secretaria, rechaza fijar/cambiar
--    can_access_both_branches o supabase_uid (INSERT y UPDATE). Admin y service role
--    (auth_user_role() NULL) no se ven afectados.
--
-- Rollback: recrear update_users con `role_id IS NULL OR role_id <> (admin)` (texto anterior en
-- 20260307120000_fix_users_rls_secretary_enrollment.sql) y DROP TRIGGER/FUNCTION de abajo.
-- Idempotente. Verificación: supabase/tests/rls/fix-179-b-users-secretaria.sql
-- ============================================================================

DROP POLICY IF EXISTS update_users ON public.users;
CREATE POLICY update_users ON public.users
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (
      auth_user_role() = 'secretary'
      AND branch_visible(branch_id)
      AND (role_id IS NULL OR role_id = (SELECT roles.id FROM roles WHERE roles.name = 'student'))
    )
  );

CREATE OR REPLACE FUNCTION public.users_guard_secretary_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Solo aplica a escrituras hechas con la sesión de una secretaria. Edge Functions con service
  -- role no tienen auth.uid() → auth_user_role() es NULL → no entran acá.
  IF public.auth_user_role() IS DISTINCT FROM 'secretary' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.can_access_both_branches, false) OR NEW.supabase_uid IS NOT NULL THEN
      RAISE EXCEPTION 'Una secretaria no puede asignar acceso multi-sede ni vincular cuentas de acceso'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.can_access_both_branches IS DISTINCT FROM OLD.can_access_both_branches
     OR NEW.supabase_uid IS DISTINCT FROM OLD.supabase_uid THEN
    RAISE EXCEPTION 'Una secretaria no puede cambiar el acceso multi-sede ni la cuenta de acceso de un usuario'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.users_guard_secretary_write() IS
  'fix-179-b: con sesión de secretaria, impide fijar/cambiar users.can_access_both_branches y users.supabase_uid. Admin y service role no se ven afectados.';

DROP TRIGGER IF EXISTS trg_users_guard_secretary_write ON public.users;
CREATE TRIGGER trg_users_guard_secretary_write
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_guard_secretary_write();
