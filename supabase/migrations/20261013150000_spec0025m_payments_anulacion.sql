-- ============================================================================
-- Spec 0025-m (ASG-i-059): un pago se ANULA, no se borra
--
-- Desde fix-044-i el admin quita un pago de la Caja con un DELETE: el pago desaparece y, si el
-- alumno reclama, no se ve que existió ni por qué se quitó. Ahora la misma fila queda con
-- status = 'anulado' y guarda quién, cuándo y el motivo.
--
-- Qué hace esta migración:
--   1. Columnas voided_at, voided_by, void_reason en payments.
--   2. Trigger guard_anulacion_pago: las reglas de la anulación viven en la BD.
--        - solo un admin anula (la policy update_payments deja a la secretaria modificar pagos
--          de su sede, así que la RLS no alcanza);
--        - motivo obligatorio;
--        - la anulación es definitiva: un pago anulado no se modifica;
--        - no se anula un pago de un día con caja cerrada (mismo criterio y mismo token que
--          guard_movimiento_caja_cerrada, fix-044-i);
--        - quién y cuándo los fija la BD, no el cliente; anular no cambia montos ni fecha.
--
-- Qué NO cambia:
--   - El saldo: recalculate_enrollment_balance() suma solo status = 'paid' y trg_update_balance
--     corre en UPDATE, así que anular ya lo saca de total_paid / pending_balance.
--   - La auditoría: log_change ya registra UPDATE en payments.
--   - El borrado: cleanup_expired_drafts, confirm_enrollment_with_payment y el descarte de
--     borradores siguen haciendo DELETE (DG-106). Este trigger no corre en DELETE.
--   - payments.status es TEXT sin CHECK: no hay restricción que ampliar.
--
-- Errores con tokens que la app traduce (db-error.utils): PAGO_YA_ANULADO, ANULAR_SOLO_ADMIN,
-- ANULAR_SIN_MOTIVO, ANULACION_INVALIDA, CAJA_CERRADA.
-- Función de trigger: no necesita GRANT EXECUTE (DG-104).
-- Idempotente. Al aplicarla con la app en uso: SET lock_timeout = '5s' y reintentar (DG-107).
-- ============================================================================

-- 1. Columnas de anulación ------------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS voided_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by   INT REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

COMMENT ON COLUMN public.payments.voided_at   IS 'Cuándo se anuló el pago (lo fija guard_anulacion_pago).';
COMMENT ON COLUMN public.payments.voided_by   IS 'Admin que anuló el pago (lo fija guard_anulacion_pago).';
COMMENT ON COLUMN public.payments.void_reason IS 'Motivo de la anulación, obligatorio al anular.';

-- 2. Reglas de la anulación -----------------------------------------------------------------
-- SECURITY DEFINER: lee enrollments y cash_closings sin depender de la RLS de quien llama.
CREATE OR REPLACE FUNCTION public.guard_anulacion_pago()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_motivo TEXT;
  v_branch INT;
BEGIN
  -- Un pago no nace anulado ni con datos de anulación.
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'anulado'
       OR NEW.voided_at IS NOT NULL OR NEW.voided_by IS NOT NULL OR NEW.void_reason IS NOT NULL THEN
      RAISE EXCEPTION 'ANULACION_INVALIDA' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- La anulación es definitiva.
  IF OLD.status = 'anulado' THEN
    RAISE EXCEPTION 'PAGO_YA_ANULADO' USING ERRCODE = 'P0001';
  END IF;

  -- Cualquier otro UPDATE: los datos de anulación no se tocan.
  IF NEW.status IS DISTINCT FROM 'anulado' THEN
    IF NEW.voided_at IS NOT NULL OR NEW.voided_by IS NOT NULL OR NEW.void_reason IS NOT NULL THEN
      RAISE EXCEPTION 'ANULACION_INVALIDA' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- Transición a 'anulado'.
  IF public.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'ANULAR_SOLO_ADMIN' USING ERRCODE = 'P0001';
  END IF;

  v_motivo := btrim(COALESCE(NEW.void_reason, ''));
  IF v_motivo = '' THEN
    RAISE EXCEPTION 'ANULAR_SIN_MOTIVO' USING ERRCODE = 'P0001';
  END IF;

  SELECT e.branch_id INTO v_branch
  FROM public.enrollments e
  WHERE e.id = OLD.enrollment_id;

  IF EXISTS (
    SELECT 1
    FROM public.cash_closings c
    WHERE c.date = OLD.payment_date
      AND c.branch_id IS NOT DISTINCT FROM v_branch
      AND c.status = 'closed'
  ) THEN
    RAISE EXCEPTION 'CAJA_CERRADA' USING ERRCODE = 'P0001';
  END IF;

  -- Anular no edita el pago: todo queda como estaba salvo el estado y los datos de anulación.
  NEW             := OLD;
  NEW.status      := 'anulado';
  NEW.void_reason := v_motivo;
  NEW.voided_by   := public.auth_user_id();
  NEW.voided_at   := NOW();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_anulacion_pago() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_payments_guard_anulacion ON public.payments;
CREATE TRIGGER trg_payments_guard_anulacion
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_anulacion_pago();
