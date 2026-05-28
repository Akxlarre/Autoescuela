-- Fix: tasks_update policy blocked soft-delete (setting deleted_at = now()).
--
-- Root cause: PostgreSQL applies USING as implicit WITH CHECK when none is specified.
-- The USING clause had `deleted_at IS NULL`, so the resulting row (with deleted_at set)
-- failed the implicit WITH CHECK → 403 Forbidden.
--
-- Fix: add an explicit WITH CHECK that omits the `deleted_at IS NULL` constraint,
-- allowing soft-deletes while still preventing updates on already-deleted rows (USING).

DROP POLICY IF EXISTS tasks_update ON public.tasks;

CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE
  USING (
    -- Only allow updating rows that are not yet deleted
    deleted_at IS NULL
    AND (
      (auth_user_role() = 'admin'      AND branch_visible(branch_id))
      OR (auth_user_role() = 'secretary' AND (from_user_id = auth_user_id() OR to_user_id = auth_user_id()))
      OR (auth_user_role() = 'instructor' AND to_user_id = auth_user_id())
    )
  )
  WITH CHECK (
    -- Resulting row just needs to pass the role/branch check (no deleted_at constraint)
    (auth_user_role() = 'admin'      AND branch_visible(branch_id))
    OR (auth_user_role() = 'secretary' AND (from_user_id = auth_user_id() OR to_user_id = auth_user_id()))
    OR (auth_user_role() = 'instructor' AND to_user_id = auth_user_id())
  );
