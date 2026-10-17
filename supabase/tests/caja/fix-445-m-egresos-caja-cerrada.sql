-- ============================================================================
-- Prueba de BD — fix-445-m: un gasto o un anticipo no se registra ni se mueve a un día con caja
-- cerrada; los cambios que no mueven dinero siguen funcionando
-- ============================================================================
-- Migración: 20261016150000_fix445_egresos_caja_cerrada.sql.
-- Los datos de base los crea postgres; las pruebas corren como el rol authenticated suplantando a
-- secretaria@test.com (sede 1, gastos) y admin@test.com (anticipos). Todo dentro de una transacción
-- que termina en RAISE: no deja cambios. Fechas 2099-07-0X (sin cierres reales). Instructor 238 es
-- de la sede 1.
--   npx supabase db query --linked -f supabase/tests/caja/fix-445-m-egresos-caja-cerrada.sql
-- El resultado sale en el mensaje del error final ("RESULT: …"); "FALLA" = ❌.
-- ============================================================================

BEGIN;

-- 2099-07-01: cerrada. 2099-07-02: sin cierre. 2099-07-04: cierre en borrador.
INSERT INTO public.cash_closings (date, branch_id, status, closed) VALUES
  ('2099-07-01', 1, 'closed', true),
  ('2099-07-04', 1, 'draft', false);

CREATE TEMP TABLE t445 ON COMMIT DROP AS
WITH g AS (
  INSERT INTO public.expenses (date, amount, branch_id, description, payment_method)
  VALUES ('2099-07-01', 5000, 1, 'Prueba fix-445 cerrado', 'efectivo'),
         ('2099-07-02', 5000, 1, 'Prueba fix-445 abierto', 'efectivo')
  RETURNING id, date
), a AS (
  INSERT INTO public.instructor_advances (instructor_id, date, amount, status, payment_method)
  VALUES (238, '2099-07-01', 8000, 'pending', 'efectivo')
  RETURNING id, date
)
SELECT 'gasto_cerrado' AS k, id FROM g WHERE date = '2099-07-01'
UNION ALL SELECT 'gasto_abierto', id FROM g WHERE date = '2099-07-02'
UNION ALL SELECT 'anticipo_cerrado', id FROM a;
GRANT SELECT ON t445 TO authenticated;

SET LOCAL role authenticated;

DO $test$
DECLARE
  r       text := '';
  v_gc    int := (SELECT id FROM t445 WHERE k = 'gasto_cerrado');
  v_ga    int := (SELECT id FROM t445 WHERE k = 'gasto_abierto');
  v_ac    int := (SELECT id FROM t445 WHERE k = 'anticipo_cerrado');
  n       int;
BEGIN
  -- Secretaria (sede 1): gastos
  PERFORM set_config('request.jwt.claims',
    '{"sub":"bc4dbbc8-2fef-433d-bede-61f00ae10976","role":"authenticated"}', true);

  BEGIN
    INSERT INTO public.expenses (date, amount, branch_id, description, payment_method)
    VALUES ('2099-07-01', 1000, 1, 'Prueba fix-445', 'efectivo');
    r := r || '1 registrar gasto en día cerrado: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '1 registrar gasto en día cerrado: ok | ';
  END;

  BEGIN
    UPDATE public.expenses SET amount = 1 WHERE id = v_gc;
    r := r || '2 cambiar monto de gasto de día cerrado: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '2 cambiar monto de gasto de día cerrado: ok | ';
  END;

  BEGIN
    UPDATE public.expenses SET date = '2099-07-01' WHERE id = v_ga;
    r := r || '3 mover gasto a día cerrado: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '3 mover gasto a día cerrado: ok | ';
  END;

  BEGIN
    UPDATE public.expenses SET description = 'Descripción corregida' WHERE id = v_gc;
    GET DIAGNOSTICS n = ROW_COUNT;
    r := r || '4 editar descripción en día cerrado: ' || CASE WHEN n = 1 THEN 'ok' ELSE 'FALLA (0 filas)' END || ' | ';
  EXCEPTION WHEN raise_exception THEN r := r || '4 editar descripción en día cerrado: FALLA | ';
  END;

  BEGIN
    INSERT INTO public.expenses (date, amount, branch_id, description, payment_method)
    VALUES ('2099-07-02', 1000, 1, 'Prueba fix-445', 'efectivo'),
           ('2099-07-04', 1000, 1, 'Prueba fix-445', 'efectivo');
    r := r || '5 día abierto y día en borrador: ok | ';
  EXCEPTION WHEN raise_exception THEN r := r || '5 día abierto y día en borrador: FALLA | ';
  END;

  -- Admin: anticipos
  PERFORM set_config('request.jwt.claims',
    '{"sub":"d3fdf4cc-2b54-4b67-8ebe-00d38d1f7fe5","role":"authenticated"}', true);

  BEGIN
    INSERT INTO public.instructor_advances (instructor_id, date, amount, status, payment_method)
    VALUES (238, '2099-07-01', 1000, 'pending', 'efectivo');
    r := r || '6 registrar anticipo en día cerrado: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '6 registrar anticipo en día cerrado: ok | ';
  END;

  BEGIN
    UPDATE public.instructor_advances SET amount = 1 WHERE id = v_ac;
    r := r || '7 cambiar monto de anticipo de día cerrado: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '7 cambiar monto de anticipo de día cerrado: ok | ';
  END;

  -- Liquidaciones marca los anticipos del mes como descontados y los devuelve a pendientes.
  BEGIN
    UPDATE public.instructor_advances SET status = 'discounted' WHERE id = v_ac;
    GET DIAGNOSTICS n = ROW_COUNT;
    UPDATE public.instructor_advances SET status = 'pending' WHERE id = v_ac;
    r := r || '8 liquidación cambia estado en día cerrado: ' || CASE WHEN n = 1 THEN 'ok' ELSE 'FALLA (0 filas)' END || ' | ';
  EXCEPTION WHEN raise_exception THEN r := r || '8 liquidación cambia estado en día cerrado: FALLA | ';
  END;

  BEGIN
    INSERT INTO public.instructor_advances (instructor_id, date, amount, status, payment_method)
    VALUES (238, '2099-07-02', 1000, 'pending', 'efectivo');
    r := r || '9 anticipo en día abierto: ok';
  EXCEPTION WHEN raise_exception THEN r := r || '9 anticipo en día abierto: FALLA';
  END;

  RAISE EXCEPTION 'RESULT: %', r;
END
$test$;

ROLLBACK;
