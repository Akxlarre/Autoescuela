-- ============================================================================
-- Fix 044-i (P0, ASG-i-048): la Caja fallaba en silencio y podía corromper saldos y cierres
--
-- Lo que esta migración cierra en la BD (el resto del fix está en cuadratura.facade.ts):
--   1. Borrar un pago no recalculaba el saldo: trg_update_balance solo corría en INSERT/UPDATE,
--      así que la Caja restaba el saldo desde el navegador y después borraba. Si el borrado
--      fallaba (la RLS solo deja borrar pagos al admin), el saldo del alumno quedaba inflado.
--   2. Se podía borrar un pago, gasto o anticipo de un día con caja cerrada: el cierre guarda
--      totales congelados (DG-065) y quedaba descuadrado sin aviso.
--   3. Un cierre 'closed' se podía sobrescribir: el upsert de una segunda pestaña (o el
--      autoguardado del borrador de una pestaña vieja) reemplazaba el cierre real. La RLS ya
--      lo impedía a la secretaria, no al admin.
--
-- Los errores usan tokens que la app traduce (db-error.utils): CAJA_CERRADA, CIERRE_DEFINITIVO.
-- Funciones de trigger: no necesitan GRANT EXECUTE (DG-104).
-- Idempotente: CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
-- ============================================================================

-- 1. El saldo se recalcula también al BORRAR un pago ------------------------------------------
-- Misma fórmula que 20260301000008_08_misc_and_triggers.sql (suma solo pagos status = 'paid');
-- lo nuevo es tomar enrollment_id de OLD en un DELETE y devolver COALESCE(NEW, OLD).
CREATE OR REPLACE FUNCTION public.recalculate_enrollment_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_enrollment_id INT := CASE WHEN TG_OP = 'DELETE' THEN OLD.enrollment_id ELSE NEW.enrollment_id END;
  v_paid          INT;
BEGIN
  SELECT COALESCE(SUM(total_amount), 0) INTO v_paid
  FROM public.payments
  WHERE enrollment_id = v_enrollment_id
    AND status = 'paid';

  UPDATE public.enrollments
  SET total_paid      = v_paid,
      pending_balance = base_price - discount - v_paid,
      payment_status  = CASE
                          WHEN base_price - discount <= v_paid THEN 'paid_full'
                          WHEN v_paid > 0 THEN 'partial'
                          ELSE 'pending'
                        END,
      updated_at      = NOW()
  WHERE id = v_enrollment_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_balance ON public.payments;
CREATE TRIGGER trg_update_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_enrollment_balance();

-- 2. No se borra un movimiento de un día con caja cerrada ------------------------------------
-- SECURITY DEFINER: la secretaria solo ve cierres de los últimos 2 días por RLS; sin esto el
-- chequeo no vería los más viejos y dejaría pasar el borrado.
-- Excepción: pagos de matrículas en 'draft'. Los borra el cron cleanup_expired_drafts y, desde
-- ASG-m-002 (pago antes de la firma), un borrador puede tener un pago 'paid': con el bloqueo
-- el cron fallaría completo.
-- La sede sale de donde la saca la Caja: enrollments.branch_id para pagos, expenses.branch_id,
-- y la sede del usuario del instructor para anticipos.
CREATE OR REPLACE FUNCTION public.guard_movimiento_caja_cerrada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fecha  DATE;
  v_branch INT;
  v_status TEXT;
BEGIN
  IF TG_TABLE_NAME = 'payments' THEN
    SELECT e.branch_id, e.status INTO v_branch, v_status
    FROM public.enrollments e
    WHERE e.id = OLD.enrollment_id;
    IF v_status = 'draft' THEN
      RETURN OLD;
    END IF;
    v_fecha := OLD.payment_date;
  ELSIF TG_TABLE_NAME = 'expenses' THEN
    v_fecha  := OLD.date;
    v_branch := OLD.branch_id;
  ELSE -- instructor_advances
    v_fecha := OLD.date;
    SELECT u.branch_id INTO v_branch
    FROM public.instructors i
    JOIN public.users u ON u.id = i.user_id
    WHERE i.id = OLD.instructor_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cash_closings c
    WHERE c.date = v_fecha
      AND c.branch_id IS NOT DISTINCT FROM v_branch
      AND c.status = 'closed'
  ) THEN
    RAISE EXCEPTION 'CAJA_CERRADA' USING ERRCODE = 'P0001';
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_movimiento_caja_cerrada() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_payments_caja_cerrada ON public.payments;
CREATE TRIGGER trg_payments_caja_cerrada
  BEFORE DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_movimiento_caja_cerrada();

DROP TRIGGER IF EXISTS trg_expenses_caja_cerrada ON public.expenses;
CREATE TRIGGER trg_expenses_caja_cerrada
  BEFORE DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.guard_movimiento_caja_cerrada();

DROP TRIGGER IF EXISTS trg_instructor_advances_caja_cerrada ON public.instructor_advances;
CREATE TRIGGER trg_instructor_advances_caja_cerrada
  BEFORE DELETE ON public.instructor_advances
  FOR EACH ROW EXECUTE FUNCTION public.guard_movimiento_caja_cerrada();

-- 3. Cierre definitivo ------------------------------------------------------------------------
-- Un cash_closings 'closed' no se modifica ni se borra, tampoco el admin. Cubre el upsert de una
-- segunda pestaña: ON CONFLICT DO UPDATE dispara el BEFORE UPDATE. Un borrador ('draft') sigue
-- editable y pasa a 'closed' normalmente (OLD.status = 'draft').
-- Las correcciones van por cuadratura_adjustments (spec 0002-i). Si alguna vez hace falta
-- corregir datos a mano, la migración que lo haga debe desactivar este trigger explícitamente.
CREATE OR REPLACE FUNCTION public.guard_cierre_definitivo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'closed' THEN
    RAISE EXCEPTION 'CIERRE_DEFINITIVO' USING ERRCODE = 'P0001';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.guard_cierre_definitivo() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cash_closings_cierre_definitivo ON public.cash_closings;
CREATE TRIGGER trg_cash_closings_cierre_definitivo
  BEFORE UPDATE OR DELETE ON public.cash_closings
  FOR EACH ROW EXECUTE FUNCTION public.guard_cierre_definitivo();
