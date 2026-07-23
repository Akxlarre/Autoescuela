-- ============================================================================
-- Fix H-024 / fix-057-m: bloquea a nivel de BD un pago cuyo monto exceda el
-- saldo pendiente de la matrícula.
-- ============================================================================
-- Contexto: la UI (registrar-pago-drawer.component.ts) ya valida esto en el
-- cliente, pero no existía ningún freno en el servidor — cualquier cliente
-- que llame directo al insert (API, script, otro front) podía registrar un
-- pago de cualquier monto sin límite.
--
-- Fuente de verdad: se espeja exactamente la misma fórmula que ya usa
-- recalculate_enrollment_balance() (20260301000008_08_misc_and_triggers.sql,
-- trg_update_balance): enrollments.pending_balance = base_price - discount -
-- SUM(payments.total_amount WHERE status = 'paid'). Como ese trigger AFTER
-- mantiene pending_balance siempre sincronizado tras cada insert, leerlo en
-- un BEFORE INSERT refleja el saldo correcto justo antes de este pago nuevo.
--
-- pending_balance NULL (matrícula sin base_price configurado aún, o draft
-- recién creado antes de su primera confirmación de pago) no bloquea — no hay
-- forma de determinar el saldo con certeza, evita falsos positivos. Aplica sin
-- importar el status del pago (incluye 'pending'): los dos únicos flujos que
-- insertan pagos 'pending' (enrollment-payment.facade.ts y el RPC
-- confirm_enrollment_with_payment) lo hacen siempre sobre un enrollment recién
-- confirmado desde 'draft', momento en que pending_balance todavía es NULL —
-- quedan protegidos por el chequeo de NULL, no por el status.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_payment_within_pending_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_pending_balance INTEGER;
BEGIN
  SELECT pending_balance INTO v_pending_balance
  FROM public.enrollments
  WHERE id = NEW.enrollment_id;

  IF v_pending_balance IS NOT NULL AND NEW.total_amount > v_pending_balance THEN
    RAISE EXCEPTION
      'El monto del pago (%) excede el saldo pendiente de la matrícula % (%)',
      NEW.total_amount, NEW.enrollment_id, v_pending_balance
      USING ERRCODE = '23514'; -- check_violation, mismo código que un CHECK constraint
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

DROP TRIGGER IF EXISTS trg_check_payment_within_pending_balance ON public.payments;

CREATE TRIGGER trg_check_payment_within_pending_balance
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.check_payment_within_pending_balance();
