-- ============================================================================
-- fix-180-b: un usuario desactivado (users.active = false) pierde su rol en la RLS
-- ============================================================================
-- Contexto (ASG-i-044): "desactivar" solo escribía users.active = false. Ningún helper de RLS lo
-- miraba, así que con su token (que dura hasta 1 h y se renovaba solo) el usuario seguía leyendo y
-- escribiendo todo lo que su rol permite.
--
-- auth_user_role() es la base de casi todas las policies del esquema. Si devuelve NULL para un
-- usuario inactivo, todas las cláusulas por rol dejan de cumplirse de inmediato, sin esperar a que
-- venza el token. El ban en Auth (Edge Functions update-secretary / update-instructor) impide
-- además el login y la renovación.
--
-- `active IS NOT FALSE`: NULL se trata como activo (mismo comportamiento que antes para filas sin
-- valor). Al 2026-10-01 no hay ningún usuario inactivo en la BD: no cambia nada para nadie activo.
--
-- Rollback: recrear la función sin la condición sobre active.
-- Verificación: supabase/tests/rls/fix-180-b-usuario-inactivo.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.name
    FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
   WHERE u.supabase_uid = auth.uid()
     AND u.active IS NOT FALSE
$$;

COMMENT ON FUNCTION public.auth_user_role() IS
  'Rol (roles.name) del usuario autenticado; NULL si no tiene fila en users o si está desactivado (active = false, fix-180-b).';
