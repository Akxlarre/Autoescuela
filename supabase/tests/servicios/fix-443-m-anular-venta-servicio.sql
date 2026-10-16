-- ============================================================================
-- Prueba de BD — fix-443-m: una venta de servicio especial se anula, no se borra
-- ============================================================================
-- Migración: 20261016130000_fix443_anular_venta_servicio.sql.
-- Corre como el rol authenticated suplantando a admin@test.com y secretaria@test.com (sede 1)
-- dentro de una transacción que termina en RAISE: no deja cambios. Fecha 2099 (sin cierres).
--   npx supabase db query --linked -f supabase/tests/servicios/fix-443-m-anular-venta-servicio.sql
-- El resultado sale en el mensaje del error final ("RESULT: …"); "FALLA" = ❌.
-- ============================================================================

BEGIN;

-- La venta de prueba la crea postgres (sin RLS) antes de cambiar de rol.
CREATE TEMP TABLE t443 ON COMMIT DROP AS
WITH v AS (
  INSERT INTO public.special_service_sales (sale_date, price, branch_id, service_name, status, paid)
  VALUES ('2099-06-01', 7000, 1, 'Prueba fix-443', 'completed', true)
  RETURNING id
)
SELECT id FROM v;
GRANT SELECT ON t443 TO authenticated;

SET LOCAL role authenticated;

DO $test$
DECLARE
  r      text := '';
  v_id   int := (SELECT id FROM t443);
  n      int;
  fila   record;
  k      record;
BEGIN
  -- Secretaria (sede 1)
  PERFORM set_config('request.jwt.claims',
    '{"sub":"bc4dbbc8-2fef-433d-bede-61f00ae10976","role":"authenticated"}', true);

  BEGIN
    UPDATE public.special_service_sales SET status = 'anulado', void_reason = 'x' WHERE id = v_id;
    r := r || '1 secretaria anula: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '1 secretaria anula: ok | ';
  END;

  DELETE FROM public.special_service_sales WHERE id = v_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  r := r || '2 secretaria borra: ' || CASE WHEN n = 0 THEN 'ok' ELSE 'FALLA' END || ' | ';

  -- Admin
  PERFORM set_config('request.jwt.claims',
    '{"sub":"d3fdf4cc-2b54-4b67-8ebe-00d38d1f7fe5","role":"authenticated"}', true);

  DELETE FROM public.special_service_sales WHERE id = v_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  r := r || '3 admin borra: ' || CASE WHEN n = 0 THEN 'ok' ELSE 'FALLA' END || ' | ';

  BEGIN
    UPDATE public.special_service_sales SET status = 'anulado', void_reason = '   ' WHERE id = v_id;
    r := r || '4 sin motivo: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '4 sin motivo: ok | ';
  END;

  SELECT * INTO k FROM public.servicios_especiales_kpis(1);
  n := k.ventas_totales;

  UPDATE public.special_service_sales
  SET status = 'anulado', void_reason = '  Cliente desistió  ', price = 1
  WHERE id = v_id;
  SELECT * INTO fila FROM public.special_service_sales WHERE id = v_id;
  r := r || '5 admin anula: '
    || CASE WHEN fila.status = 'anulado' AND NOT fila.paid AND fila.price = 7000
              AND fila.void_reason = 'Cliente desistió' AND fila.voided_by IS NOT NULL
              AND fila.voided_at IS NOT NULL
            THEN 'ok' ELSE 'FALLA' END || ' | ';

  SELECT * INTO k FROM public.servicios_especiales_kpis(1);
  r := r || '6 KPIs sin la anulada: ' || CASE WHEN k.ventas_totales = n - 1 THEN 'ok' ELSE 'FALLA' END || ' | ';

  BEGIN
    UPDATE public.special_service_sales SET status = 'completed', paid = true WHERE id = v_id;
    r := r || '7 desanular: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '7 desanular: ok | ';
  END;

  UPDATE public.special_service_sales SET service_id = NULL WHERE id = v_id;
  r := r || '8 desvincular servicio de una anulada: ok';

  RAISE EXCEPTION 'RESULT: %', r;
END
$test$;

ROLLBACK;
