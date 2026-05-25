-- Fix: tasks_insert policy for secretary was rejecting tasks sent to admin.
-- The condition `branch_id = (SELECT branch_id FROM users WHERE id = to_user_id)`
-- evaluates to NULL when the admin recipient has branch_id = NULL, blocking the INSERT.
--
-- Fix: when to_role = 'admin', skip the recipient branch_id check (admin is cross-branch).
-- The task is anchored to the secretary's branch via `branch_id = auth_user_branch_id()`.

DROP POLICY IF EXISTS tasks_insert ON public.tasks;

CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT WITH CHECK (
    (
      -- Admin creates tasks in their accessible branches
      auth_user_role() = 'admin'
      AND from_user_id = auth_user_id()
      AND from_role = 'admin'
      AND to_role IN ('secretary', 'instructor')
      AND branch_visible(branch_id)
      AND branch_id = (SELECT branch_id FROM public.users WHERE id = to_user_id)
    )
    OR
    (
      -- Secretary creates tasks anchored to their own branch
      auth_user_role() = 'secretary'
      AND from_user_id = auth_user_id()
      AND from_role = 'secretary'
      AND to_role IN ('admin', 'instructor')
      AND branch_id = auth_user_branch_id()
      AND (
        -- Admin recipients are cross-branch; skip recipient branch check
        to_role = 'admin'
        -- Instructor recipients must be in the same branch
        OR branch_id = (SELECT branch_id FROM public.users WHERE id = to_user_id)
      )
    )
  );
