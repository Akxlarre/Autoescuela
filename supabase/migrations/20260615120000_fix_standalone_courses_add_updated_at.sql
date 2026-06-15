-- Fix: standalone_courses no tenía columna updated_at, causando fallo del cron
-- auto_transition_standalone_course_status() a las 06:00 UTC.
ALTER TABLE public.standalone_courses
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.auto_transition_standalone_course_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.standalone_courses
  SET    status     = 'active',
         updated_at = NOW()
  WHERE  status     = 'upcoming'
    AND  start_date <= CURRENT_DATE;
END;
$$;
