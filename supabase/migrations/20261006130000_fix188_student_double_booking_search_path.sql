-- Fix 188-b: prevent_student_double_booking_class_b_sessions() (fix-301-m) no fijaba su
-- search_path y usaba tablas sin calificar. Por DG-063, un trigger SECURITY DEFINER sin
-- search_path propio hereda el de quien lo dispara: desde una función con search_path = ''
-- falla con 'relation "enrollments" does not exist'. Hoy latente (el cron y la penalización
-- solo escriben no_show/cancelled, estados con los que el trigger sale antes de leer tablas).
--
-- Misma lógica, mismo mensaje, mismo trigger: solo search_path = '' + tablas con public.

CREATE OR REPLACE FUNCTION public.prevent_student_double_booking_class_b_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_id public.enrollments.student_id%TYPE;
BEGIN
  IF NEW.status IN ('cancelled', 'no_show') OR NEW.scheduled_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.enrollment_id = OLD.enrollment_id
     AND NEW.scheduled_at IS NOT DISTINCT FROM OLD.scheduled_at
     AND NEW.duration_min IS NOT DISTINCT FROM OLD.duration_min
     AND OLD.status NOT IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  SELECT e.student_id INTO v_student_id
  FROM public.enrollments e
  WHERE e.id = NEW.enrollment_id;

  IF v_student_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.class_b_sessions cb
    JOIN public.enrollments e ON e.id = cb.enrollment_id
    WHERE e.student_id = v_student_id
      AND cb.id IS DISTINCT FROM NEW.id
      AND cb.status NOT IN ('cancelled', 'no_show')
      AND cb.scheduled_at IS NOT NULL
      AND NEW.scheduled_at < (cb.scheduled_at + (COALESCE(cb.duration_min, 45) * INTERVAL '1 minute'))
      AND cb.scheduled_at < (NEW.scheduled_at + (COALESCE(NEW.duration_min, 45) * INTERVAL '1 minute'))
  ) THEN
    RAISE EXCEPTION 'El alumno ya tiene otra clase agendada que se solapa con este horario.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
