-- ============================================================================
-- fix-432-m — Servicios especiales: una venta no se registra, modifica ni borra en un día con
-- caja cerrada
-- ============================================================================
-- J09 (fix-429-m): el candado de "Borrar venta" vivía solo en el navegador
-- (ServiciosEspecialesFacade.borrarVenta). Desde la consola, cualquier usuario con permiso de
-- DELETE borraba una venta de un día ya cerrado (probado: venta #10, 27-08-2026, sede 2). Es el
-- mismo hueco que fix-044-i (borrar) y fix-051-i (registrar) cerraron para pagos, egresos y
-- anticipos: el cierre guarda totales congelados (DG-065) y la Caja deja de cuadrar.
--
-- Regla: si la caja de la sede de la venta está 'closed' para ese día, se rechaza
--   · INSERT con esa fecha,
--   · UPDATE de una venta de ese día (o que la mueva a ese día),
--   · DELETE de una venta de ese día.
-- La sede es special_service_sales.branch_id, la misma con que la Caja la suma.
--
-- SECURITY DEFINER: la secretaria solo ve cierres de los últimos 2 días por RLS; sin esto el
-- chequeo no vería los más viejos. Función de trigger: no necesita GRANT EXECUTE (DG-104).
-- El mensaje va en español con SQLSTATE P0001: ErrorSanitizerService lo muestra tal cual.
-- Idempotente. Al aplicarla con la app en uso: SET lock_timeout = '5s' y reintentar (DG-107).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_venta_servicio_caja_cerrada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_accion TEXT;
BEGIN
  v_accion := CASE TG_OP
    WHEN 'INSERT' THEN 'registrar'
    WHEN 'UPDATE' THEN 'modificar'
    ELSE 'borrar'
  END;

  -- Día y sede de la venta tal como estaba (UPDATE, DELETE).
  IF TG_OP IN ('UPDATE', 'DELETE') AND EXISTS (
    SELECT 1
    FROM public.cash_closings c
    WHERE c.date = OLD.sale_date
      AND c.branch_id IS NOT DISTINCT FROM OLD.branch_id
      AND c.status = 'closed'
  ) THEN
    RAISE EXCEPTION 'La caja del % ya está cerrada: no se puede % una venta de ese día.',
      to_char(OLD.sale_date, 'DD-MM-YYYY'), v_accion
      USING ERRCODE = 'P0001';
  END IF;

  -- Día y sede nuevos (INSERT, UPDATE).
  IF TG_OP IN ('INSERT', 'UPDATE') AND EXISTS (
    SELECT 1
    FROM public.cash_closings c
    WHERE c.date = NEW.sale_date
      AND c.branch_id IS NOT DISTINCT FROM NEW.branch_id
      AND c.status = 'closed'
  ) THEN
    RAISE EXCEPTION 'La caja del % ya está cerrada: no se puede % una venta con esa fecha.',
      to_char(NEW.sale_date, 'DD-MM-YYYY'), v_accion
      USING ERRCODE = 'P0001';
  END IF;

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_venta_servicio_caja_cerrada() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_special_service_sales_caja_cerrada ON public.special_service_sales;
CREATE TRIGGER trg_special_service_sales_caja_cerrada
  BEFORE INSERT OR UPDATE OR DELETE ON public.special_service_sales
  FOR EACH ROW EXECUTE FUNCTION public.guard_venta_servicio_caja_cerrada();
