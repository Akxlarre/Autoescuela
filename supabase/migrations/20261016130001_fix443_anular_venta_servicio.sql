-- ============================================================================
-- fix-443-m — Una venta de servicio especial se ANULA, no se borra
-- ============================================================================
-- Hasta acá "Borrar venta" (Historial) y "Eliminar ingreso" (Caja) hacían DELETE: la venta
-- desaparecía de todas las pantallas y solo quedaba en audit_log. Decisión de negocio
-- (2026-10-16): las ventas se anulan como los pagos de matrícula (spec 0025-m) y solo el admin
-- anula.
--
--   1. Columnas voided_at, voided_by, void_reason (mismos nombres que payments: la app reutiliza
--      mapAnulacionPago y PAYMENT_ANULACION_SELECT).
--   2. Trigger guard_anulacion_venta_servicio:
--        - solo un admin anula; motivo obligatorio;
--        - quién y cuándo los fija la BD; anular no cambia monto, fecha ni sede, y deja paid = false
--          (todas las sumas de ingresos filtran paid = true);
--        - una anulada no se "desanula" ni se modifica, salvo desvincular el servicio
--          (borrarServicioDefinitivo, fix-024-i);
--        - un día con caja cerrada lo rechaza el trigger de fix-432-m/fix-444-m (corre antes:
--          trg_special_service_sales_caja_cerrada < trg_special_service_sales_guard_anulacion).
--   3. Sin policy de DELETE: nadie borra una venta desde la app.
--   4. servicios_especiales_kpis() no cuenta las anuladas.
--
-- status tenía un CHECK (completed, pending): se amplía con anulado. Mensajes en español con SQLSTATE P0001 (ErrorSanitizerService los
-- muestra tal cual). Función de trigger: no necesita GRANT EXECUTE (DG-104).
-- Idempotente. Al aplicarla con la app en uso: SET lock_timeout = '5s' y reintentar (DG-107).
-- ============================================================================

-- 1. Columnas de anulación ------------------------------------------------------------------
ALTER TABLE public.special_service_sales
  ADD COLUMN IF NOT EXISTS voided_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by   INT REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

COMMENT ON COLUMN public.special_service_sales.voided_at   IS 'Cuándo se anuló la venta (lo fija guard_anulacion_venta_servicio).';
COMMENT ON COLUMN public.special_service_sales.voided_by   IS 'Admin que anuló la venta (lo fija guard_anulacion_venta_servicio).';
COMMENT ON COLUMN public.special_service_sales.void_reason IS 'Motivo de la anulación, obligatorio al anular.';

-- status admitía solo 'completed' y 'pending' (special_service_sales_status_check).
ALTER TABLE public.special_service_sales DROP CONSTRAINT IF EXISTS special_service_sales_status_check;
ALTER TABLE public.special_service_sales
  ADD CONSTRAINT special_service_sales_status_check
  CHECK (status = ANY (ARRAY['completed'::text, 'pending'::text, 'anulado'::text]));

-- 2. Reglas de la anulación -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_anulacion_venta_servicio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_motivo TEXT;
BEGIN
  -- Una venta no nace anulada ni con datos de anulación.
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'anulado'
       OR NEW.voided_at IS NOT NULL OR NEW.voided_by IS NOT NULL OR NEW.void_reason IS NOT NULL THEN
      RAISE EXCEPTION 'Una venta no se puede registrar como anulada.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- La anulación es definitiva: solo se permite desvincular el servicio (fix-024-i).
  IF OLD.status = 'anulado' THEN
    IF (to_jsonb(NEW) - 'service_id') IS DISTINCT FROM (to_jsonb(OLD) - 'service_id') THEN
      RAISE EXCEPTION 'Esta venta ya está anulada.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- Cualquier otro UPDATE: los datos de anulación no se tocan.
  IF NEW.status IS DISTINCT FROM 'anulado' THEN
    IF NEW.voided_at IS NOT NULL OR NEW.voided_by IS NOT NULL OR NEW.void_reason IS NOT NULL THEN
      RAISE EXCEPTION 'Los datos de anulación solo se guardan al anular.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- Transición a 'anulado'.
  IF public.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede anular una venta.' USING ERRCODE = 'P0001';
  END IF;

  v_motivo := btrim(COALESCE(NEW.void_reason, ''));
  IF v_motivo = '' THEN
    RAISE EXCEPTION 'Indica el motivo de la anulación.' USING ERRCODE = 'P0001';
  END IF;

  -- Anular no edita la venta: todo queda como estaba salvo el estado, paid y la anulación.
  NEW             := OLD;
  NEW.status      := 'anulado';
  NEW.paid        := false;
  NEW.void_reason := v_motivo;
  NEW.voided_by   := public.auth_user_id();
  NEW.voided_at   := NOW();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_anulacion_venta_servicio() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_special_service_sales_guard_anulacion ON public.special_service_sales;
CREATE TRIGGER trg_special_service_sales_guard_anulacion
  BEFORE INSERT OR UPDATE ON public.special_service_sales
  FOR EACH ROW EXECUTE FUNCTION public.guard_anulacion_venta_servicio();

-- 3. Nadie borra una venta desde la app -----------------------------------------------------
DROP POLICY IF EXISTS delete_special_service_sales ON public.special_service_sales;

-- 4. KPIs sin las anuladas ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.servicios_especiales_kpis(p_branch_id INT DEFAULT NULL)
RETURNS TABLE (
  ventas_mes         INT,
  ventas_totales     INT,
  recaudacion_mes    BIGINT,
  recaudacion_total  BIGINT,
  ventas_cobradas    INT,
  pendiente_cobro    BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH ventas AS (
    SELECT
      s.price,
      s.paid,
      date_trunc('month', s.sale_date) = date_trunc('month', public.chile_today()) AS del_mes
    FROM public.special_service_sales s
    WHERE (p_branch_id IS NULL OR s.branch_id = p_branch_id)
      AND s.status IS DISTINCT FROM 'anulado'
  )
  SELECT
    COUNT(*) FILTER (WHERE del_mes)::INT,
    COUNT(*)::INT,
    COALESCE(SUM(price) FILTER (WHERE paid AND del_mes), 0)::BIGINT,
    COALESCE(SUM(price) FILTER (WHERE paid), 0)::BIGINT,
    COUNT(*) FILTER (WHERE paid)::INT,
    COALESCE(SUM(price) FILTER (WHERE NOT paid), 0)::BIGINT
  FROM ventas;
$$;
