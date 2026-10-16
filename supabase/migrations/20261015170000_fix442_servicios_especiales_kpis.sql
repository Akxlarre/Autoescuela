-- ============================================================================
-- fix-442-m — KPIs de Servicios especiales calculados en la BD
-- ============================================================================
-- S7 (fix-429-m): los KPIs se sumaban en el navegador sobre la lista de ventas, pedida con
-- .limit(200): pasada la venta 200 de una sede, "Ventas Totales" y "Recaudación Total" se
-- congelaban sin aviso. Esta función los calcula sobre todas las ventas.
--
-- SECURITY INVOKER: la RLS de special_service_sales (spec 0047-b) acota lo que ve quien llama
-- (la secretaria sin grant, solo su sede). p_branch_id NULL = todas las que pueda ver.
-- "Del mes" = mes en curso en hora de Chile (public.chile_today(), regla dates.md).
-- Idempotente.
-- ============================================================================

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
    WHERE p_branch_id IS NULL OR s.branch_id = p_branch_id
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

REVOKE ALL ON FUNCTION public.servicios_especiales_kpis(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.servicios_especiales_kpis(INT) TO authenticated;
