-- RPC: soft_delete_task
--
-- Why RPC instead of UPDATE via RLS:
-- PostgreSQL STABLE functions (auth.uid(), auth_user_role(), branch_visible()) are
-- cached per-statement. The BEFORE trigger trg_tasks_updated_at fires between the
-- USING and WITH CHECK evaluations of an UPDATE policy, resetting the STABLE cache.
-- This causes auth.uid() to return NULL in the WITH CHECK context → 42501 for admins.
--
-- SECURITY DEFINER bypasses the tasks_update RLS entirely. Permission logic is
-- reimplemented inline in PL/pgSQL where no STABLE caching occurs.

CREATE OR REPLACE FUNCTION public.soft_delete_task(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id       INT;
  v_role          TEXT;
  v_can_both      BOOLEAN;
  v_user_branch   INT;
  v_task_branch   INT;
  v_task_from     INT;
  v_task_to       INT;
BEGIN
  -- Resolve current authenticated user
  SELECT u.id, r.name, u.can_access_both_branches, u.branch_id
    INTO v_user_id, v_role, v_can_both, v_user_branch
    FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
   WHERE u.supabase_uid = auth.uid();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Resolve task (must not be already deleted)
  SELECT branch_id, from_user_id, to_user_id
    INTO v_task_branch, v_task_from, v_task_to
    FROM public.tasks
   WHERE id = p_task_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Permission check (mirrors canDeleteTask() from frontend)
  IF v_role = 'admin'
     AND (v_task_branch IS NULL OR v_can_both OR v_user_branch = v_task_branch) THEN
    -- Admin can delete any task in their accessible branch(es)
    NULL;
  ELSIF (v_role IN ('secretary', 'instructor'))
        AND v_task_from = v_user_id THEN
    -- Non-admin can only delete tasks they sent, enforced in UI by status='pending' check
    NULL;
  ELSE
    RETURN FALSE;
  END IF;

  UPDATE public.tasks SET deleted_at = NOW() WHERE id = p_task_id;
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_task(UUID) TO authenticated;
