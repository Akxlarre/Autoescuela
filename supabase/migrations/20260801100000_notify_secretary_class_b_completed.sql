-- ============================================================================
-- Fix-091-m (ASG-b-044) — Alerta a secretaría cuando un instructor cierra
-- una clase.
--
-- Extiende notify_class_b_completed() (20260710000000, spec 0026 C1), que ya
-- notifica al alumno, para que también notifique a TODAS las secretarias de
-- la sede de la matrícula. Una notificación por clase completada (mismo
-- patrón que la del alumno) — sin agregación ni resumen. Decisión validada
-- con el owner (2026-08-01): sin tope de ruido por ahora.
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_class_b_completed()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_user_id INT;
  v_branch_id INT;
  v_secretary_user_id INT;
BEGIN
  SELECT s.user_id, e.branch_id INTO v_student_user_id, v_branch_id
  FROM public.enrollments e
  JOIN public.students s ON s.id = e.student_id
  WHERE e.id = NEW.enrollment_id;

  IF v_student_user_id IS NOT NULL THEN
    INSERT INTO public.notifications
      (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
    VALUES
      (v_student_user_id, 'system', 'Clase completada',
       'Clase ' || NEW.class_number || '/12 completada.',
       'class_b', NEW.enrollment_id, false, true);
  END IF;

  IF v_branch_id IS NOT NULL THEN
    FOR v_secretary_user_id IN
      SELECT u.id
      FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE r.name = 'secretary'
        AND u.branch_id = v_branch_id
    LOOP
      INSERT INTO public.notifications
        (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
      VALUES
        (v_secretary_user_id, 'system', 'Clase cerrada por instructor',
         'Clase ' || NEW.class_number || '/12 completada por el instructor.',
         'class_b', NEW.enrollment_id, false, true);
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Un fallo al notificar jamás debe abortar el UPDATE real de la clase (AC-E2).
  RAISE WARNING 'notify_class_b_completed error (session_id=%): %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION notify_class_b_completed() IS
  'Spec 0026 (C1) + fix-091-m (ASG-b-044): notifica al alumno y a todas las secretarias de la sede cuando una clase práctica B pasa a completed. SECURITY DEFINER porque el actor (instructor) no tiene INSERT en notifications vía RLS.';
