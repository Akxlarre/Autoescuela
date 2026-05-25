-- Fix: insert_notifications policy only allowed 'admin'.
-- Secretary needs to create notifications when sending tasks to admin/instructors.

DROP POLICY IF EXISTS insert_notifications ON public.notifications;

CREATE POLICY insert_notifications ON public.notifications
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));
