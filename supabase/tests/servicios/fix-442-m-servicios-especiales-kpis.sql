-- ============================================================================
-- Prueba de BD — fix-442-m: KPIs de Servicios especiales sin tope
-- ============================================================================
-- Migración: 20261015170000_fix442_servicios_especiales_kpis.sql.
-- Siembra 205 ventas en una sede de prueba con fechas 2099 (no chocan con datos reales) dentro de
-- un bloque que SIEMPRE aborta. Correr como postgres:
--   npx supabase db query --linked -f supabase/tests/servicios/fix-442-m-servicios-especiales-kpis.sql
-- El resultado sale en el mensaje del error final ("RESULT: …"); "FALLA" = ❌.
-- ============================================================================

DO $test$
DECLARE
  r     text := '';
  k     record;
  antes record;
BEGIN
  SELECT * INTO antes FROM public.servicios_especiales_kpis(1);

  -- 200 ventas cobradas de $1.000 y 5 sin cobrar de $500, todas fuera del mes en curso.
  INSERT INTO public.special_service_sales (sale_date, price, branch_id, service_name, status, paid)
  SELECT '2099-05-01', 1000, 1, 'Prueba fix-442', 'completed', true FROM generate_series(1, 200);
  INSERT INTO public.special_service_sales (sale_date, price, branch_id, service_name, status, paid)
  SELECT '2099-05-01', 500, 1, 'Prueba fix-442', 'pending', false FROM generate_series(1, 5);

  SELECT * INTO k FROM public.servicios_especiales_kpis(1);
  r := r || '1 total sin tope: '
    || CASE WHEN k.ventas_totales = antes.ventas_totales + 205 THEN 'ok' ELSE 'FALLA' END || ' | ';
  r := r || '2 recaudación total: '
    || CASE WHEN k.recaudacion_total = antes.recaudacion_total + 200000 THEN 'ok' ELSE 'FALLA' END || ' | ';
  r := r || '3 pendiente: '
    || CASE WHEN k.pendiente_cobro = antes.pendiente_cobro + 2500 THEN 'ok' ELSE 'FALLA' END || ' | ';
  r := r || '4 fuera del mes no suma al mes: '
    || CASE WHEN k.ventas_mes = antes.ventas_mes THEN 'ok' ELSE 'FALLA' END || ' | ';

  -- Otra sede no se mezcla.
  SELECT * INTO k FROM public.servicios_especiales_kpis(2);
  r := r || '5 otra sede intacta: '
    || CASE WHEN k.ventas_totales < antes.ventas_totales + 205 THEN 'ok' ELSE 'FALLA' END;

  RAISE EXCEPTION 'RESULT: %', r;
END
$test$;
