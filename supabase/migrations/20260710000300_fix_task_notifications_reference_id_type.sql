-- ============================================================================
-- Spec 0026 (C2) — Fix: notifications.reference_id es INT, tasks.id es UUID.
--
-- Las funciones originales (20260710000100) intentaban castear NEW.task_id
-- (UUID) a texto e insertarlo en reference_id (INT), lo que provoca un error
-- de tipo ("invalid input syntax for type integer") en cada INSERT — atrapado
-- silenciosamente por el EXCEPTION WHEN OTHERS de la función, así que el
-- INSERT/UPDATE real de la tarea nunca fallaba, pero la notificación NUNCA
-- se llegaba a crear. Detectado en QA en vivo (spec 0026).
--
-- Fix: reference_id queda NULL para notificaciones de tipo task. No es
-- crítico — el deep-link de 'task' en topbar.onNotifClicked() (Spec 0024)
-- ya enruta a la página general de tareas por rol, sin necesitar un id
-- específico.
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_task_reply()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_from INT;
  v_to INT;
  v_recipient INT;
  v_subject TEXT;
BEGIN
  SELECT from_user_id, to_user_id, subject
  INTO v_from, v_to, v_subject
  FROM public.tasks
  WHERE id = NEW.task_id;

  v_recipient := CASE WHEN NEW.from_user_id = v_from THEN v_to ELSE v_from END;

  IF v_recipient IS NOT NULL AND v_recipient != NEW.from_user_id THEN
    INSERT INTO public.notifications
      (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
    VALUES
      (v_recipient, 'system', 'Nueva respuesta',
       'Respondieron en: ' || v_subject,
       'task', NULL, false, true);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_task_reply error (reply_id=%): %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_task_completed()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor INT;
  v_recipient INT;
BEGIN
  v_actor := public.auth_user_id();
  v_recipient := CASE WHEN v_actor = NEW.from_user_id THEN NEW.to_user_id ELSE NEW.from_user_id END;

  IF v_recipient IS NOT NULL AND v_recipient != v_actor THEN
    INSERT INTO public.notifications
      (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
    VALUES
      (v_recipient, 'system', 'Tarea completada', NEW.subject,
       'task', NULL, false, true);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_task_completed error (task_id=%): %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION notify_task_reply() IS
  'Spec 0026 (C2): notifica a la contraparte de una tarea cuando la otra parte responde en el hilo. reference_id NULL (fix 20260710000300): tasks.id es UUID, notifications.reference_id es INT.';

COMMENT ON FUNCTION notify_task_completed() IS
  'Spec 0026 (C2): notifica a la contraparte cuando una tarea se marca completed. Usa auth_user_id() para excluir al actor real (AC7). reference_id NULL (fix 20260710000300).';
