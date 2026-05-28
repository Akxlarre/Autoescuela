-- Fix: tasks_update WITH CHECK fails for admin when using STABLE SECURITY DEFINER helpers.
--
-- Root cause: PostgreSQL re-evaluates STABLE functions after the BEFORE trigger
-- (trg_tasks_updated_at) fires, potentially in a different planner context than
-- the USING clause evaluation. The STABLE cache may be invalidated, causing
-- auth_user_role() / branch_visible() to return unexpected results in WITH CHECK.
--
-- Fix: replace STABLE helper function calls with inline correlated subqueries.
-- Semantically equivalent to the previous policy; avoids STABLE caching issues.

DROP POLICY IF EXISTS tasks_update ON public.tasks;

CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.supabase_uid = auth.uid()
        AND (
          (r.name = 'admin'
            AND (tasks.branch_id IS NULL OR u.can_access_both_branches OR u.branch_id = tasks.branch_id))
          OR (r.name = 'secretary'
            AND (tasks.from_user_id = u.id OR tasks.to_user_id = u.id))
          OR (r.name = 'instructor'
            AND tasks.to_user_id = u.id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.supabase_uid = auth.uid()
        AND (
          (r.name = 'admin'
            AND (tasks.branch_id IS NULL OR u.can_access_both_branches OR u.branch_id = tasks.branch_id))
          OR (r.name = 'secretary'
            AND (tasks.from_user_id = u.id OR tasks.to_user_id = u.id))
          OR (r.name = 'instructor'
            AND tasks.to_user_id = u.id)
        )
    )
  );
