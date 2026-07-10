-- ============================================================================
-- Spec 0026 (D1) — Fix: payment_mode real es 'total'|'partial', no 'deposit'.
--
-- `indices/DATABASE.md` documentaba enrollments.payment_mode como
-- ('total'|'deposit'), pero la verificación en vivo (QA de spec 0026) mostró
-- que los valores reales en producción son 'total' y 'partial'. El guard de
-- notify_deposit_reminder() (20260710000000) usaba 'deposit' y por lo tanto
-- NUNCA se hubiera disparado. Se corrige aquí antes de dar la spec por
-- verificada. indices/DATABASE.md también se corrige en el mismo cierre.
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
    AND e.payment_mode = 'partial'
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

COMMENT ON FUNCTION notify_deposit_reminder() IS
  'Spec 0026 (D1, RF-018): al completarse la clase 6, avisa al alumno con matrícula por abono (payment_mode=partial) y saldo pendiente que debe pagar antes de la clase 7. Guard corregido en 20260710000200 (el valor real es partial, no deposit).';
