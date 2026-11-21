-- ============================================================================
-- fix-444-m — El candado de caja cerrada de las ventas mira solo las columnas de dinero
-- ============================================================================
-- Regresión de fix-432-m: guard_venta_servicio_caja_cerrada() rechazaba CUALQUIER UPDATE de una
-- venta de un día cerrado, también el "service_id = NULL" con que borrarServicioDefinitivo()
-- (fix-024-i) desvincula las ventas antes de borrar un servicio. Eliminar un servicio con ventas de
-- días cerrados fallaba. Desvincular no cambia ningún monto: el cierre no se descuadra.
--
-- Ahora, en UPDATE, la caja solo se revisa si cambia alguna columna que mueve la caja:
-- price, sale_date, branch_id, payment_method, paid o status. INSERT y DELETE no cambian.
-- Idempotente (CREATE OR REPLACE; el trigger de fix-432-m sigue apuntando a esta función).
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
  -- fix-444-m: un UPDATE que no toca dinero (p. ej. desvincular el servicio) no se bloquea.
  IF TG_OP = 'UPDATE'
     AND NEW.price          IS NOT DISTINCT FROM OLD.price
     AND NEW.sale_date      IS NOT DISTINCT FROM OLD.sale_date
     AND NEW.branch_id      IS NOT DISTINCT FROM OLD.branch_id
     AND NEW.payment_method IS NOT DISTINCT FROM OLD.payment_method
     AND NEW.paid           IS NOT DISTINCT FROM OLD.paid
     AND NEW.status         IS NOT DISTINCT FROM OLD.status
  THEN
    RETURN NEW;
  END IF;

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
