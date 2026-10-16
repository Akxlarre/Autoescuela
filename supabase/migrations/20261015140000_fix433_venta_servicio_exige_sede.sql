-- ============================================================================
-- fix-433-m — Servicios especiales: una venta siempre tiene sede
-- ============================================================================
-- H07 (fix-429-m): fix-194-b impidió vender sin sede desde el formulario, pero la BD lo aceptaba
-- (branch_id nullable y la policy de INSERT de la secretaria admite branch_id IS NULL). Una venta
-- sin sede no entra a la Caja ni a los reportes de ninguna sede (DG-082).
--
-- NOT VALID: la restricción rige para toda fila nueva o modificada, pero no revisa las que ya
-- existen. Hay una venta histórica sin sede (#3, 2026-08-06); asignarle sede es decisión aparte.
-- Idempotente.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'special_service_sales_branch_required'
      AND conrelid = 'public.special_service_sales'::regclass
  ) THEN
    ALTER TABLE public.special_service_sales
      ADD CONSTRAINT special_service_sales_branch_required CHECK (branch_id IS NOT NULL) NOT VALID;
  END IF;
END
$$;
