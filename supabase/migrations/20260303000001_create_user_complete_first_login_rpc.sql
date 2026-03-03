-- Migración: RPC segura para marcar first_login = false
--
-- PROBLEMA: El RLS de la tabla `users` no permite que roles no-admin
-- ejecuten UPDATE. Crear esta función como SECURITY DEFINER permite
-- que cualquier usuario autenticado actualice ÚNICAMENTE su propia fila.
--
-- Uso desde el cliente Angular:
--   await supabase.client.rpc('user_complete_first_login');

CREATE OR REPLACE FUNCTION public.user_complete_first_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo actualiza la fila del usuario que está haciendo la solicitud
  UPDATE public.users
  SET first_login = false
  WHERE supabase_uid = auth.uid();
END;
$$;
