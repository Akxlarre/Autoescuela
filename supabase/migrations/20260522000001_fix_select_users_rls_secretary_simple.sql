-- Fix: migration 20260521000004 added branch_visible() to secretary's SELECT policy.
-- branch_visible() can return NULL (not FALSE) when auth_user_branch_id() is NULL,
-- making all non-admin users invisible to secretary in certain configurations.
--
-- Root cause: mixing PostgREST branch filter with RLS branch_visible() is fragile.
-- The secretary needs to see: instructors (task recipients) + admins (task recipients).
-- Branch scoping for secretary's queries is handled at the PostgREST layer in
-- tasks.facade.ts, NOT in RLS.
--
-- Correct fix: secretary sees ALL users in RLS (mirrors original policy from
-- 20260301000011, extended to also include admin rows).

DROP POLICY IF EXISTS select_users ON public.users;

CREATE POLICY select_users ON public.users
  FOR SELECT USING (
    -- admin sees all users
    auth_user_role() = 'admin'
    -- secretary sees all users (instructors + admins for task recipients;
    -- branch scoping is enforced at query level in TasksFacade.loadRecipients)
    OR auth_user_role() = 'secretary'
    -- instructors and students only see themselves
    OR (auth_user_role() IN ('instructor', 'student') AND id = auth_user_id())
  );
