-- Fix: secretaria cannot see admin rows via RLS on users table,
-- which prevents admin from appearing in the task recipient selector.
--
-- Solution: a narrow SECURITY DEFINER function that encodes the canSendTo
-- matrix (secretary→admin|instructor, admin→secretary|instructor) and
-- returns only the allowed recipients for the calling user.
-- This bypasses the RLS block without broadening SELECT on the users table.

CREATE OR REPLACE FUNCTION public.get_task_recipients()
RETURNS TABLE (
  id                  INT,
  first_names         TEXT,
  paternal_last_name  TEXT,
  branch_id           INT,
  role_name           TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    u.id,
    u.first_names,
    u.paternal_last_name,
    u.branch_id,
    r.name AS role_name
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE
    u.active = true
    AND u.id != public.auth_user_id()
    AND (
      -- secretaria → admin (cross-branch) + instructor (same branch only)
      (
        public.auth_user_role() = 'secretaria'
        AND (
          r.name = 'admin'
          OR (r.name = 'instructor' AND u.branch_id = public.auth_user_branch_id())
        )
      )
      -- admin → secretaria + instructor (client applies branch filter if needed)
      OR (
        public.auth_user_role() = 'admin'
        AND r.name IN ('secretaria', 'instructor')
      )
    );
$$;

-- Grant execute to authenticated users (RLS is bypassed inside via SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public.get_task_recipients() TO authenticated;
