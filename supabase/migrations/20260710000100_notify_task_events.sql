-- ============================================================================
-- Spec 0026 (Ola 3, Grupo C2) — Notificaciones por trigger SQL en tareas.
--
-- El actor de estos eventos puede ser CUALQUIERA de las dos partes de una
-- tarea (admin, secretaria o instructor, según to_role/from_role de la
-- tarea) — no solo admin/secretaria, así que hoy ni siquiera el emisor
-- admin recibe aviso cuando le responden. Se resuelve con funciones
-- SECURITY DEFINER, mismo patrón que 20260710000000_notify_class_b_session_events.sql.
--
-- notify_task_reply()     — AFTER INSERT ON task_replies: notifica a la
--                            contraparte de quien escribió (nunca al autor).
-- notify_task_completed() — AFTER UPDATE OF status ON tasks (a 'completed'):
--                            usa auth_user_id() (ya existe en el proyecto,
--                            20260301000011_10_rls_policies.sql:23) para
--                            identificar al actor real que cerró la tarea y
--                            excluirlo — notifica solo a la contraparte (AC7).
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
       'task', NEW.task_id::text, false, true);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Un fallo al notificar jamás debe abortar el INSERT de la respuesta real (AC-E2).
  RAISE WARNING 'notify_task_reply error (reply_id=%): %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_task_reply ON public.task_replies;
CREATE TRIGGER trg_notify_task_reply
  AFTER INSERT ON public.task_replies
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_reply();

COMMENT ON FUNCTION notify_task_reply() IS
  'Spec 0026 (C2): notifica a la contraparte de una tarea cuando la otra parte responde en el hilo. SECURITY DEFINER porque el actor puede ser instructor/alumno sin INSERT en notifications vía RLS.';

-- ============================================================================

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
       'task', NEW.id::text, false, true);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_task_completed error (task_id=%): %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_task_completed ON public.tasks;
CREATE TRIGGER trg_notify_task_completed
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION notify_task_completed();

COMMENT ON FUNCTION notify_task_completed() IS
  'Spec 0026 (C2): notifica a la contraparte cuando una tarea se marca completed. Usa auth_user_id() para excluir al actor real que cerró la tarea (AC7).';
