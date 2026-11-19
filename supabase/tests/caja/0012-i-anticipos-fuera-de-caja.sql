-- ============================================================================
-- Prueba de BD — spec 0012-i, fase 1 (AC15 y AC17)
--   AC15: el anticipo ya no es parte de la caja: se registra, cambia y borra aunque la caja de su
--         fecha esté cerrada. Un gasto en ese mismo día sigue bloqueado (el candado no se aflojó).
--   AC17: las horas se guardan exactas (3 clases = 2,25 h).
-- ============================================================================
-- Migración: 20261119120000_spec0012i_f1_anticipos_fuera_de_caja_horas_exactas.sql.
-- Corre como el rol authenticated suplantando a admin@test.com (anticipos) y a
-- secretaria@test.com (gasto, sede 1). Instructor 238 es de la sede 1. Todo dentro de una
-- transacción que termina en RAISE: no deja cambios. Fechas 2099-07-0X (sin cierres reales).
--   npx supabase db query --linked -f supabase/tests/caja/0012-i-anticipos-fuera-de-caja.sql
-- El resultado sale en el mensaje del error final ("RESULT: …"); "FALLA" = ❌.
-- ============================================================================

BEGIN;

INSERT INTO public.cash_closings (date, branch_id, status, closed) VALUES
  ('2099-07-01', 1, 'closed', true);

CREATE TEMP TABLE t0012 ON COMMIT DROP AS
WITH a AS (
  INSERT INTO public.instructor_advances (instructor_id, date, amount, status, payment_method)
  VALUES (238, '2099-07-01', 8000, 'pending', 'efectivo')
  RETURNING id
)
SELECT id FROM a;
GRANT SELECT ON t0012 TO authenticated;

-- AC17: la función de horas, llamada como el trigger (postgres), con 3 clases inventadas.
DO $horas$
DECLARE
  v_instr int := 238;
  v_period text := '2099-07';
  v_eq numeric;
BEGIN
  INSERT INTO public.instructor_monthly_hours (instructor_id, period, theory_hours, practical_sessions, total_equivalent)
  VALUES (v_instr, v_period, 0, 3, 3 * 0.75)
  ON CONFLICT (instructor_id, period) DO UPDATE SET total_equivalent = 3 * 0.75;
  SELECT total_equivalent INTO v_eq FROM public.instructor_monthly_hours
  WHERE instructor_id = v_instr AND period = v_period;
  PERFORM set_config('test.horas', v_eq::text, true);

  -- Sin clases completadas en 2099-07, la función borra la fila: confirma que corre sin error.
  PERFORM public.recalc_instructor_monthly_hours(v_instr, v_period);
  PERFORM set_config('test.horas_sin_clases',
    (SELECT count(*)::text FROM public.instructor_monthly_hours
     WHERE instructor_id = v_instr AND period = v_period), true);

  PERFORM set_config('test.tipo',
    (SELECT numeric_scale::text FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'instructor_monthly_hours'
       AND column_name = 'total_equivalent'), true);
END
$horas$;

SET LOCAL role authenticated;

DO $test$
DECLARE
  r     text := '';
  v_ac  int := (SELECT id FROM t0012 LIMIT 1);
  n     int;
BEGIN
  -- Admin: anticipos en día cerrado
  PERFORM set_config('request.jwt.claims',
    '{"sub":"d3fdf4cc-2b54-4b67-8ebe-00d38d1f7fe5","role":"authenticated"}', true);

  BEGIN
    INSERT INTO public.instructor_advances (instructor_id, date, amount, status, payment_method)
    VALUES (238, '2099-07-01', 1000, 'pending', 'efectivo');
    r := r || '1 registrar anticipo en día cerrado: ok | ';
  EXCEPTION WHEN raise_exception THEN r := r || '1 registrar anticipo en día cerrado: FALLA | ';
  END;

  BEGIN
    UPDATE public.instructor_advances SET amount = 9000 WHERE id = v_ac;
    GET DIAGNOSTICS n = ROW_COUNT;
    r := r || '2 cambiar monto de anticipo de día cerrado: ' || CASE WHEN n = 1 THEN 'ok' ELSE 'FALLA (0 filas)' END || ' | ';
  EXCEPTION WHEN raise_exception THEN r := r || '2 cambiar monto de anticipo de día cerrado: FALLA | ';
  END;

  BEGIN
    DELETE FROM public.instructor_advances WHERE id = v_ac;
    GET DIAGNOSTICS n = ROW_COUNT;
    r := r || '3 borrar anticipo de día cerrado: ' || CASE WHEN n = 1 THEN 'ok' ELSE 'FALLA (0 filas)' END || ' | ';
  EXCEPTION WHEN raise_exception THEN r := r || '3 borrar anticipo de día cerrado: FALLA | ';
  END;

  -- Secretaria (sede 1): el gasto en el mismo día cerrado sigue bloqueado
  PERFORM set_config('request.jwt.claims',
    '{"sub":"bc4dbbc8-2fef-433d-bede-61f00ae10976","role":"authenticated"}', true);

  BEGIN
    INSERT INTO public.expenses (date, amount, branch_id, description, payment_method)
    VALUES ('2099-07-01', 1000, 1, 'Prueba 0012-i', 'efectivo');
    r := r || '4 gasto en día cerrado sigue bloqueado: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '4 gasto en día cerrado sigue bloqueado: ok | ';
  END;

  -- AC17
  r := r || '5 columna de horas con 2 decimales: '
    || CASE WHEN current_setting('test.tipo', true) = '2' THEN 'ok' ELSE 'FALLA (' || coalesce(current_setting('test.tipo', true), 'null') || ')' END || ' | ';
  r := r || '6 3 clases = 2,25 h: '
    || CASE WHEN current_setting('test.horas', true)::numeric = 2.25 THEN 'ok' ELSE 'FALLA (' || current_setting('test.horas', true) || ')' END || ' | ';
  r := r || '7 recálculo sin clases borra la fila: '
    || CASE WHEN current_setting('test.horas_sin_clases', true) = '0' THEN 'ok' ELSE 'FALLA' END;

  RAISE EXCEPTION 'RESULT: %', r;
END
$test$;

ROLLBACK;
