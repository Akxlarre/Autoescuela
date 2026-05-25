-- Root cause: the original select_users policy used 'secretary' (English) but
-- roles.name stores 'secretaria' (Spanish). The mismatch caused the secretary
-- condition to NEVER match, leaving secretaria with zero visible users via RLS.
--
-- Additionally, get_task_recipients() SECURITY DEFINER is not needed once RLS
-- is correct, and auth.uid() is unreliable inside SECURITY DEFINER in this setup.
--
-- Fix:
--   1. Drop both RPC versions.
--   2. Recreate select_users with correct Spanish role name and allow secretaria
--      to see admin rows (needed for task recipient selection).

DROP FUNCTION IF EXISTS public.get_task_recipients();

DROP POLICY IF EXISTS select_users ON public.users;

CREATE POLICY select_users ON public.users
  FOR SELECT USING (
    -- admin sees all users
    auth_user_role() = 'admin'
    -- secretaria sees all users (needs admin for tasks, students for enrollment)
    OR auth_user_role() = 'secretaria'
    -- instructors and students only see themselves
    OR (auth_user_role() IN ('instructor', 'student') AND id = auth_user_id())
  );
