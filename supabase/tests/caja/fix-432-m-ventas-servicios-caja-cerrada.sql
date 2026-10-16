-- ============================================================================
-- Prueba de BD — fix-432-m: una venta de servicio especial no se registra, modifica ni borra en
-- un día con caja cerrada
-- ============================================================================
-- Migración: 20261015130000_fix432_ventas_servicios_caja_cerrada.sql.
-- Todo corre dentro de un bloque que SIEMPRE aborta: no deja ventas ni cierres de prueba. Las
-- fechas (2099-03-0X) no chocan con cierres reales. Correr como postgres:
--   npx supabase db query --linked -f supabase/tests/caja/fix-432-m-ventas-servicios-caja-cerrada.sql
-- El resultado sale en el mensaje del error final ("RESULT: …"); "FALLA" = ❌.
-- ============================================================================

DO $test$
DECLARE
  r       text := '';
  v_venta int;
  v_otra  int;
  n       int;
BEGIN
  -- Día 2099-03-01: sede 1 con una venta y la caja cerrada; sede 2 abierta.
  INSERT INTO public.special_service_sales (sale_date, price, branch_id, service_name, status, paid)
  VALUES ('2099-03-01', 1000, 1, 'Prueba fix-432', 'completed', true)
  RETURNING id INTO v_venta;
  INSERT INTO public.special_service_sales (sale_date, price, branch_id, service_name, status, paid)
  VALUES ('2099-03-02', 1000, 1, 'Prueba fix-432', 'completed', true)
  RETURNING id INTO v_otra;
  INSERT INTO public.cash_closings (date, branch_id, status, closed)
  VALUES ('2099-03-01', 1, 'closed', true);

  BEGIN
    DELETE FROM public.special_service_sales WHERE id = v_venta;
    r := r || '1 borrar en caja cerrada: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '1 borrar en caja cerrada: ok | ';
  END;

  BEGIN
    UPDATE public.special_service_sales SET price = 1 WHERE id = v_venta;
    r := r || '2 modificar en caja cerrada: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '2 modificar en caja cerrada: ok | ';
  END;

  BEGIN
    UPDATE public.special_service_sales SET sale_date = '2099-03-01' WHERE id = v_otra;
    r := r || '3 mover a un día cerrado: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '3 mover a un día cerrado: ok | ';
  END;

  BEGIN
    INSERT INTO public.special_service_sales (sale_date, price, branch_id, service_name, status, paid)
    VALUES ('2099-03-01', 1000, 1, 'Prueba fix-432', 'completed', true);
    r := r || '4 registrar en caja cerrada: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '4 registrar en caja cerrada: ok | ';
  END;

  -- La otra sede, el mismo día, sigue abierta.
  INSERT INTO public.special_service_sales (sale_date, price, branch_id, service_name, status, paid)
  VALUES ('2099-03-01', 1000, 2, 'Prueba fix-432', 'completed', true);
  r := r || '5 otra sede mismo día: ok | ';

  -- Un día sin cierre: se modifica y se borra normalmente.
  UPDATE public.special_service_sales SET price = 2 WHERE id = v_otra;
  DELETE FROM public.special_service_sales WHERE id = v_otra;
  GET DIAGNOSTICS n = ROW_COUNT;
  r := r || '6 día abierto: ' || CASE WHEN n = 1 THEN 'ok' ELSE 'FALLA' END;

  RAISE EXCEPTION 'RESULT: %', r;
END
$test$;
