-- fix-212-b (S14 de ASG-i-034): "Último acceso" de la secretaria mostraba users.updated_at.
--
-- users no tiene trigger de updated_at: en las 8 secretarias es igual a created_at, o sea la ficha
-- mostraba la fecha de creación de la cuenta como "Último acceso". El último inicio de sesión real
-- vive en auth.users.last_sign_in_at, que el cliente no puede leer.
--
-- Esta función lo expone de forma acotada:
--   - solo responde si quien llama es admin (la página de Secretarias es solo de admin);
--   - solo devuelve usuarios con rol secretary (no sirve para mirar logins de otros roles);
--   - solo user_id + last_sign_in_at.
-- SECURITY DEFINER con search_path vacío; EXECUTE revocado a PUBLIC/anon (Postgres lo da a PUBLIC
-- por defecto). Idempotente (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.secretary_last_sign_in(p_user_ids integer[])
RETURNS TABLE (user_id integer, last_sign_in_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id, a.last_sign_in_at
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  LEFT JOIN auth.users a ON a.id = u.supabase_uid
  WHERE u.id = ANY (p_user_ids)
    AND r.name = 'secretary'
    AND public.auth_user_role() = 'admin';
$$;

REVOKE ALL ON FUNCTION public.secretary_last_sign_in(integer[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretary_last_sign_in(integer[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.secretary_last_sign_in(integer[]) IS
  'fix-212-b: último inicio de sesión (auth.users) de secretarias. Solo admin; solo rol secretary.';
