-- ============================================================================
-- Fix-148-m — Notificación a secretaría al cerrar clase B: detalle, total
-- dinámico y actor.
--
-- Extiende notify_class_b_completed() (20260710000000 + 20260801100000) para
-- corregir 3 problemas detectados por el owner:
-- 1. El mensaje a secretaría no identifica la matrícula ni el alumno.
-- 2. El total de clases estaba fijo en "/12", ignorando courses.is_reinforcement
--    (spec 0006-m: matrícula de refuerzo = 6 clases, no 12).
-- 3. Se disparaba sin mirar quién hizo el UPDATE — si secretaría o admin
--    cerraban la clase (AsistenciaClaseBFacade.finalizarClase(), usado por
--    ambos roles), secretaría recibía una notificación de su propia acción
--    con texto falso ("completada por el instructor").
--
-- auth_user_role() lee auth.uid() del JWT de la request que disparó el
-- UPDATE (no se ve afectado por SECURITY DEFINER, que solo eleva permisos de
-- objeto) — por eso sirve para identificar al actor real dentro del trigger.
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_class_b_completed()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_user_id INT;
  v_branch_id INT;
  v_enrollment_number TEXT;
  v_student_name TEXT;
  v_total_classes INT;
  v_secretary_user_id INT;
BEGIN
  SELECT
    s.user_id,
    e.branch_id,
    e.number,
    TRIM(COALESCE(SPLIT_PART(u.first_names, ' ', 1), '') || ' ' || COALESCE(u.paternal_last_name, '')),
    CASE WHEN c.is_reinforcement THEN 6 ELSE 12 END
  INTO v_student_user_id, v_branch_id, v_enrollment_number, v_student_name, v_total_classes
  FROM public.enrollments e
  JOIN public.students s ON s.id = e.student_id
  JOIN public.users u ON u.id = s.user_id
  JOIN public.courses c ON c.id = e.course_id
  WHERE e.id = NEW.enrollment_id;

  IF v_student_user_id IS NOT NULL THEN
    INSERT INTO public.notifications
      (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
    VALUES
      (v_student_user_id, 'system', 'Clase completada',
       'Clase ' || NEW.class_number || '/' || v_total_classes || ' completada.',
       'class_b', NEW.enrollment_id, false, true);
  END IF;

  -- Solo notificar a secretaría cuando quien cierra la clase es el instructor.
  -- Si cierra secretaría o admin, sería notificarle a secretaría su propia acción.
  IF v_branch_id IS NOT NULL AND public.auth_user_role() = 'instructor' THEN
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
         'Clase ' || NEW.class_number || '/' || v_total_classes ||
         ' de matrícula #' || COALESCE(v_enrollment_number, NEW.enrollment_id::TEXT) ||
         ' (' || v_student_name || ') completada por el instructor.',
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
  'Spec 0026 (C1) + fix-091-m (ASG-b-044) + fix-148-m: notifica al alumno (total dinámico 6/12 según courses.is_reinforcement) y a secretaría de la sede — solo cuando el actor real es el instructor — con detalle de matrícula y alumno. SECURITY DEFINER porque el actor (instructor) no tiene INSERT en notifications vía RLS.';
