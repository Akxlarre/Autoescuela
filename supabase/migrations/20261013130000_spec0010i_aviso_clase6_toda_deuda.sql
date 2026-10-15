-- ============================================================================
-- Spec 0010-i (Entrega 2, AC7): aviso tras la clase 6 para TODA matrícula con deuda
--
-- notify_deposit_reminder() (spec 0026, corregida en 20260710000200) solo avisaba con
-- payment_mode = 'partial' (abono) y solo al alumno: un "Cobrar después" no avisaba a nadie y la
-- secretaria se enteraba recién cuando la clase 7 quedaba bloqueada (20261013120000).
-- Ahora: cualquier modalidad con pending_balance > 0, al alumno y además a las secretarias
-- activas de la sede y a todos los admins activos.
-- Excluye "Refuerzo Clase B": su clase 6 es la última, no hay clase 7 que cobrar.
-- El trigger trg_notify_deposit_reminder (clase 6 → completed) no cambia: solo la función.
-- Nunca aborta el UPDATE de la clase (EXCEPTION WHEN OTHERS → WARNING). Idempotente.
-- ============================================================================

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.notify_deposit_reminder()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_user_id INT;
  v_pending         INT;
  v_branch_id       INT;
  v_student_name    TEXT;
  v_monto           TEXT;
  v_staff_id        INT;
BEGIN
  SELECT s.user_id, e.pending_balance, e.branch_id,
         TRIM(COALESCE(SPLIT_PART(u.first_names, ' ', 1), '') || ' ' || COALESCE(u.paternal_last_name, ''))
  INTO v_student_user_id, v_pending, v_branch_id, v_student_name
  FROM public.enrollments e
  JOIN public.students s ON s.id = e.student_id
  JOIN public.users u ON u.id = s.user_id
  JOIN public.courses c ON c.id = e.course_id
  WHERE e.id = NEW.enrollment_id
    AND e.pending_balance > 0
    AND c.is_reinforcement IS NOT TRUE;

  IF v_student_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_monto := '$' || replace(to_char(v_pending, 'FM999,999,999'), ',', '.');

  -- Alumno
  INSERT INTO public.notifications
    (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
  VALUES
    (v_student_user_id, 'system', 'Pago pendiente',
     'Te queda un saldo de ' || v_monto || ' por pagar antes de tu clase 7.',
     'payment', NEW.enrollment_id, false, true);

  -- Secretarias de la sede + todos los admins
  FOR v_staff_id IN
    SELECT u.id FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.active = true
      AND (r.name = 'admin' OR (r.name = 'secretary' AND u.branch_id = v_branch_id))
  LOOP
    INSERT INTO public.notifications
      (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
    VALUES
      (v_staff_id, 'system', 'Cobrar antes de la clase 7',
       v_student_name || ' completó la clase 6 y debe ' || v_monto ||
       '. Sin el pago, la clase 7 queda bloqueada.',
       'enrollment', NEW.enrollment_id, false, true);
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_deposit_reminder error (session_id=%): %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.notify_deposit_reminder() IS
  'Spec 0026 (D1) + spec 0010-i (AC7): al completarse la clase 6, si la matrícula tiene saldo '
  '(cualquier modalidad, no Refuerzo) avisa al alumno, a las secretarias activas de la sede y a '
  'todos los admins activos. Nunca aborta el UPDATE de la clase.';
