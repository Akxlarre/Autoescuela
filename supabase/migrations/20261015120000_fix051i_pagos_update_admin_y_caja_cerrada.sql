-- ============================================================================
-- fix-051-i — Pagos: solo el admin los modifica, y no se registran en un día con caja cerrada
-- ============================================================================
-- B1-1 (fix-048-i): update_payments dejaba a la secretaria modificar cualquier columna de los
-- pagos de su sede. Por consola podía subir un monto (el tope de sobrepago es solo BEFORE INSERT)
-- o pasar un pago a 'pending' (lo saca del saldo sin dejar rastro de anulación). Ninguna pantalla
-- de la secretaria hace UPDATE de pagos: el único es la anulación del admin desde la Caja. Las
-- edge functions usan service_role (sin RLS) y las RPC son SECURITY DEFINER.
--
-- B2-3 (fix-048-i): fix-044-i bloqueó BORRAR y 0025-m ANULAR movimientos de un día con caja
-- cerrada, pero se podía INSERTAR un pago con esa fecha. El cierre guarda totales congelados
-- (DG-065), así que ese pago no entraba a ningún cierre y la Caja dejaba de cuadrar.
-- Decisión de negocio (2026-10-15): también la caja de hoy, si ya se cerró.
-- Excepción: un INSERT sin usuario de sesión (auth.uid() NULL: pago online por edge function con
-- service_role) no se bloquea — el cobro ya ocurrió y rechazarlo lo perdería.
--
-- El mensaje va en español con SQLSTATE P0001: ErrorSanitizerService lo muestra tal cual.
-- Función de trigger: no necesita GRANT EXECUTE (DG-104).
-- Idempotente. Al aplicarla con la app en uso: SET lock_timeout = '5s' y reintentar (DG-107).
-- ============================================================================

-- 1. UPDATE de pagos: solo admin ------------------------------------------------------------
DROP POLICY IF EXISTS update_payments ON public.payments;
CREATE POLICY update_payments ON public.payments
  FOR UPDATE USING (auth_user_role() = 'admin');

-- 2. No se registra un pago con fecha de un día con caja cerrada ----------------------------
-- SECURITY DEFINER: la secretaria solo ve cierres de los últimos 2 días por RLS; sin esto el
-- chequeo no vería los más viejos. La sede sale de donde la saca la Caja (enrollments.branch_id),
-- igual que guard_movimiento_caja_cerrada().
CREATE OR REPLACE FUNCTION public.guard_pago_en_caja_cerrada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_branch INT;
BEGIN
  -- Pago sin fecha ('pending'): no es un movimiento de caja todavía.
  IF NEW.payment_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Pago online sin usuario de sesión (edge function con service_role): no se bloquea.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT e.branch_id INTO v_branch
  FROM public.enrollments e
  WHERE e.id = NEW.enrollment_id;

  IF EXISTS (
    SELECT 1
    FROM public.cash_closings c
    WHERE c.date = NEW.payment_date
      AND c.branch_id IS NOT DISTINCT FROM v_branch
      AND c.status = 'closed'
  ) THEN
    RAISE EXCEPTION 'La caja del % ya está cerrada: no se puede registrar un pago con esa fecha.',
      to_char(NEW.payment_date, 'DD-MM-YYYY')
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_pago_en_caja_cerrada() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_payments_insert_caja_cerrada ON public.payments;
CREATE TRIGGER trg_payments_insert_caja_cerrada
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_pago_en_caja_cerrada();
