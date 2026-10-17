-- ============================================================================
-- Prueba de BD — fix-433-m: una venta de servicio especial siempre tiene sede
-- ============================================================================
-- Migración: 20261015140000_fix433_venta_servicio_exige_sede.sql.
-- Todo corre dentro de un bloque que SIEMPRE aborta: no deja ventas de prueba. Correr como postgres:
--   npx supabase db query --linked -f supabase/tests/caja/fix-433-m-venta-servicio-exige-sede.sql
-- El resultado sale en el mensaje del error final ("RESULT: …"); "FALLA" = ❌.
-- ============================================================================

DO $test$
DECLARE
  r       text := '';
  v_venta int;
BEGIN
  BEGIN
    INSERT INTO public.special_service_sales (sale_date, price, branch_id, service_name, status, paid)
    VALUES ('2099-04-01', 1000, NULL, 'Prueba fix-433', 'completed', true);
    r := r || '1 registrar sin sede: FALLA | ';
  EXCEPTION WHEN check_violation THEN r := r || '1 registrar sin sede: ok | ';
  END;

  INSERT INTO public.special_service_sales (sale_date, price, branch_id, service_name, status, paid)
  VALUES ('2099-04-01', 1000, 1, 'Prueba fix-433', 'completed', true)
  RETURNING id INTO v_venta;
  r := r || '2 registrar con sede: ok | ';

  BEGIN
    UPDATE public.special_service_sales SET branch_id = NULL WHERE id = v_venta;
    r := r || '3 quitar la sede: FALLA';
  EXCEPTION WHEN check_violation THEN r := r || '3 quitar la sede: ok';
  END;

  RAISE EXCEPTION 'RESULT: %', r;
END
$test$;
