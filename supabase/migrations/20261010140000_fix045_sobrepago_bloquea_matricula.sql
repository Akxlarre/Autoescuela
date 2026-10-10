-- ============================================================================
-- Fix 045-i (P0, ASG-i-049): dos pagos simultáneos podían dejar el saldo negativo
--
-- check_payment_within_pending_balance() (trg_check_payment_within_pending_balance, BEFORE INSERT
-- en payments, 20260723010000_fix_h024…) leía enrollments.pending_balance con un SELECT simple.
-- Dos pagos simultáneos sobre la misma matrícula leían el mismo saldo y pasaban ambos (saldo
-- $100.000, dos pagos de $80.000 → −$60.000).
--
-- Ahora el SELECT bloquea la fila de la matrícula (FOR UPDATE): el segundo pago espera a que el
-- primero termine y valida contra el saldo ya recalculado por trg_update_balance (AFTER INSERT, en
-- la misma transacción del primero). La espera solo ocurre entre pagos a la MISMA matrícula.
--
-- SECURITY DEFINER: FOR UPDATE aplica las policies de UPDATE de quien inserta. Si para algún rol la
-- fila no pasara esa policy, el SELECT volvería vacío (v_pending_balance NULL) y el chequeo se
-- saltaría en silencio. Es función de trigger: no necesita GRANT EXECUTE (DG-104).
-- Misma regla y mismo mensaje que la versión anterior; solo cambia cómo se lee el saldo.
-- Idempotente: CREATE OR REPLACE. No recrea el trigger.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_payment_within_pending_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pending_balance INTEGER;
BEGIN
  SELECT pending_balance INTO v_pending_balance
  FROM public.enrollments
  WHERE id = NEW.enrollment_id
  FOR UPDATE;

  IF v_pending_balance IS NOT NULL AND NEW.total_amount > v_pending_balance THEN
    RAISE EXCEPTION
      'El monto del pago (%) excede el saldo pendiente de la matrícula % (%)',
      NEW.total_amount, NEW.enrollment_id, v_pending_balance
      USING ERRCODE = '23514'; -- check_violation, mismo código que un CHECK constraint
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_payment_within_pending_balance() FROM PUBLIC, anon, authenticated;
