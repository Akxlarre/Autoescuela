-- Fix: migration 20260521000003 used 'secretaria' (Spanish) but roles.name
-- stores 'secretary' (English) per seed data. This broke secretary login entirely.
--
-- Correct fix: restore policy with 'secretary' (English) and extend it to
-- allow secretary to see admin rows for task recipient selection.

DROP POLICY IF EXISTS select_users ON public.users;

CREATE POLICY select_users ON public.users
  FOR SELECT USING (
    -- admin sees all users
    auth_user_role() = 'admin'
    -- secretary sees: admin users (for task recipients) + branch-scoped non-admin users
    OR (auth_user_role() = 'secretary'
        AND (
          -- admin users are visible cross-branch (needed for task recipient selector)
          role_id = (SELECT id FROM public.roles WHERE name = 'admin')
          -- same branch: instructors, students, temp accounts
          OR (branch_visible(branch_id)
              AND (role_id IS NULL OR role_id != (SELECT id FROM public.roles WHERE name = 'admin')))
        ))
    -- instructors and students only see themselves
    OR (auth_user_role() IN ('instructor', 'student') AND id = auth_user_id())
  );
