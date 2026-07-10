-- ============================================================================
-- Spec 0026 (Ola 3, Grupo C1 + D1) — Notificaciones por trigger SQL.
--
-- El actor de estos eventos es el INSTRUCTOR (finishClass() actualiza
-- class_b_sessions), que no tiene permiso de INSERT en notifications vía
-- RLS (insert_notifications solo permite admin/secretary). Se resuelve con
-- funciones SECURITY DEFINER, mismo patrón ya usado por
-- verify_class_b_certificate_enablement() / trg_enable_certificate_b
-- (20260301000008_08_misc_and_triggers.sql:411).
--
-- C1 — Clase completada: notifica al alumno cada vez que una clase práctica
--       pasa a status='completed', con el progreso "N/12".
-- D1 — Aviso de 2ª cuota: en la MISMA transición (clase completada), si
--       class_number=6 y la matrícula es por abono con saldo pendiente,
--       notifica que debe pagar antes de la clase 7. Es un trigger separado
--       (no un IF dentro del mismo) para que cada evento sea independiente
--       y se pueda desactivar/ajustar uno sin tocar el otro.
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_class_b_completed()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_user_id INT;
BEGIN
  SELECT s.user_id INTO v_student_user_id
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

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Un fallo al notificar jamás debe abortar el UPDATE real de la clase (AC-E2).
  RAISE WARNING 'notify_class_b_completed error (session_id=%): %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_class_b_completed ON public.class_b_sessions;
CREATE TRIGGER trg_notify_class_b_completed
  AFTER UPDATE OF status ON public.class_b_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION notify_class_b_completed();

COMMENT ON FUNCTION notify_class_b_completed() IS
  'Spec 0026 (C1): notifica al alumno cuando una clase práctica B pasa a completed. SECURITY DEFINER porque el actor (instructor) no tiene INSERT en notifications vía RLS.';

-- ============================================================================

CREATE OR REPLACE FUNCTION notify_deposit_reminder()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_user_id INT;
  v_pending INT;
BEGIN
  SELECT s.user_id, e.pending_balance
  INTO v_student_user_id, v_pending
  FROM public.enrollments e
  JOIN public.students s ON s.id = e.student_id
  WHERE e.id = NEW.enrollment_id
    AND e.payment_mode = 'deposit'
    AND e.pending_balance > 0;

  IF v_student_user_id IS NOT NULL THEN
    INSERT INTO public.notifications
      (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
    VALUES
      (v_student_user_id, 'system', 'Pago pendiente',
       'Te queda un saldo de $' || v_pending || ' por pagar antes de tu próxima clase.',
       'payment', NEW.enrollment_id, false, true);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_deposit_reminder error (session_id=%): %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_deposit_reminder ON public.class_b_sessions;
CREATE TRIGGER trg_notify_deposit_reminder
  AFTER UPDATE OF status ON public.class_b_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.class_number = 6)
  EXECUTE FUNCTION notify_deposit_reminder();

COMMENT ON FUNCTION notify_deposit_reminder() IS
  'Spec 0026 (D1, RF-018): al completarse la clase 6, avisa al alumno con matrícula por abono y saldo pendiente que debe pagar antes de la clase 7. Guard payment_mode=deposit AND pending_balance>0 evita ruido (AC-E3/AC-E4).';
