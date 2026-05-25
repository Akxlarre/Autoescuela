-- Fix v2: replace get_task_recipients() — previous version used SET search_path = ''
-- which reset session GUCs that auth.uid() depends on, causing all helper functions
-- (auth_user_id, auth_user_role, auth_user_branch_id) to return NULL → empty result.
--
-- This version resolves caller identity inline via auth.uid() without SET search_path,
-- and fully qualifies all schema references manually.

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
AS $$
  SELECT
    u.id,
    u.first_names,
    u.paternal_last_name,
    u.branch_id,
    r.name AS role_name
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  -- Resolve the calling user's context inline
  CROSS JOIN LATERAL (
    SELECT
      caller_u.id          AS caller_id,
      caller_r.name        AS caller_role,
      caller_u.branch_id   AS caller_branch
    FROM public.users caller_u
    JOIN public.roles caller_r ON caller_r.id = caller_u.role_id
    WHERE caller_u.supabase_uid = auth.uid()
  ) AS caller
  WHERE
    u.active = true
    AND u.id != caller.caller_id
    AND (
      -- secretaria → admin (cross-branch) or instructor (same branch)
      (
        caller.caller_role = 'secretaria'
        AND (
          r.name = 'admin'
          OR (r.name = 'instructor' AND u.branch_id = caller.caller_branch)
        )
      )
      -- admin → secretaria or instructor (client applies branch filter)
      OR (
        caller.caller_role = 'admin'
        AND r.name IN ('secretaria', 'instructor')
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_task_recipients() TO authenticated;
