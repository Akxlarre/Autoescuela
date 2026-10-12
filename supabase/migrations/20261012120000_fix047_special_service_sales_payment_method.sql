-- ============================================================================
-- Fix 047-i (P0, ASG-i-051): las ventas de servicios especiales guardan con qué se pagaron
--
-- special_service_sales no tenía medio de pago. La Caja Diaria mandaba toda venta a la columna
-- "otros", que desde fix-230-m se muestra como Tarjeta: una venta pagada en efectivo quedaba fuera
-- del arqueo físico. Ahora el formulario de venta pide el medio de pago y la Caja lo respeta.
--
-- Ventas existentes: se asumen en efectivo (decisión de Ignacio, 2026-10-12). Los cierres de caja
-- ya hechos no cambian: guardan totales congelados (DG-065).
-- Aplicada en el piloto el 2026-10-12 (Ignacio, SQL Editor) antes de subir el front que la usa.
-- Idempotente: ADD COLUMN IF NOT EXISTS, UPDATE solo de nulos, DROP CONSTRAINT IF EXISTS.
-- ============================================================================

SET lock_timeout = '5s';

ALTER TABLE public.special_service_sales
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

UPDATE public.special_service_sales
SET payment_method = 'efectivo'
WHERE payment_method IS NULL;

ALTER TABLE public.special_service_sales
  ALTER COLUMN payment_method SET DEFAULT 'efectivo',
  ALTER COLUMN payment_method SET NOT NULL;

ALTER TABLE public.special_service_sales
  DROP CONSTRAINT IF EXISTS special_service_sales_payment_method_check;
ALTER TABLE public.special_service_sales
  ADD CONSTRAINT special_service_sales_payment_method_check
  CHECK (payment_method IN ('efectivo', 'transferencia', 'tarjeta'));
