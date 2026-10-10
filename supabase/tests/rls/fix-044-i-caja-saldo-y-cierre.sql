-- ============================================================================
-- Prueba de BD — fix-044-i: saldo al borrar un pago, días cerrados y cierre definitivo
-- ============================================================================
-- ACs en specs/fixes/fix-044-i-cuadratura-operaciones-fallan-en-silencio/fix.md.
-- Migración: 20261010120000_fix044_caja_saldo_y_cierre_definitivo.sql.
-- Todo lo que escribe corre en sub-bloques que SIEMPRE abortan (ZZ001): no deja pagos, gastos
-- ni cierres de prueba. Las fechas de prueba (2099-01-0X) no chocan con cierres reales.
-- Los resultados se acumulan en una variable (v_rows) y se escriben en r044 al final: una fila
-- insertada en r044 DENTRO de un sub-bloque que aborta se deshace junto con él.
-- Correr como postgres. Resultado en la tabla temporal r044 (último SELECT); "FALLA" = ❌.
-- Datos de prueba: una matrícula no borrador con sede y saldo pendiente ≥ 1.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r044;
CREATE TEMP TABLE r044 (n int, caso text, esperado text, obtenido text);

DO $test$
DECLARE
  v_rows    jsonb := '[]'::jsonb;
  v_enr     int;
  v_branch  int;
  v_paid0   int;
  v_paid1   int;
  v_pay     int;
  v_exp     int;
  v_closing int;
  v_err     text;
  v_txt     text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT id, branch_id INTO v_enr, v_branch
  FROM public.enrollments
  WHERE status <> 'draft' AND branch_id IS NOT NULL AND pending_balance >= 1
  ORDER BY id DESC LIMIT 1;
  IF v_enr IS NULL THEN RAISE EXCEPTION 'Faltan datos de prueba'; END IF;

  -- ── Triggers instalados ───────────────────────────────────────────────────
  SELECT string_agg(tgname, ', ' ORDER BY tgname) INTO v_txt
  FROM pg_trigger
  WHERE NOT tgisinternal AND tgname IN (
    'trg_update_balance', 'trg_payments_caja_cerrada', 'trg_expenses_caja_cerrada',
    'trg_instructor_advances_caja_cerrada', 'trg_cash_closings_cierre_definitivo');
  v_rows := v_rows || jsonb_build_object('n', 1, 'caso', 'Triggers instalados',
    'esperado', 'trg_cash_closings_cierre_definitivo, trg_expenses_caja_cerrada, trg_instructor_advances_caja_cerrada, trg_payments_caja_cerrada, trg_update_balance',
    'obtenido', v_txt);

  -- ── AC-1: borrar un pago recalcula el saldo en la BD ──────────────────────
  BEGIN
    SELECT total_paid INTO v_paid0 FROM public.enrollments WHERE id = v_enr;
    INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
    VALUES (v_enr, 1, 1, 'paid', DATE '2099-01-01')
    RETURNING id INTO v_pay;
    SELECT total_paid INTO v_paid1 FROM public.enrollments WHERE id = v_enr;
    v_rows := v_rows || jsonb_build_object('n', 2,
      'caso', 'AC-1 total_paid sube 1 al registrar el pago (control)',
      'esperado', (v_paid0 + 1)::text, 'obtenido', v_paid1::text);

    DELETE FROM public.payments WHERE id = v_pay;
    SELECT total_paid INTO v_paid1 FROM public.enrollments WHERE id = v_enr;
    v_rows := v_rows || jsonb_build_object('n', 3,
      'caso', 'AC-1 total_paid vuelve al valor previo al borrar el pago',
      'esperado', v_paid0::text, 'obtenido', v_paid1::text);
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  -- ── AC-6: no se borra un pago ni un gasto de un día con caja cerrada ──────
  BEGIN
    INSERT INTO public.cash_closings (date, branch_id, status, closed)
    VALUES (DATE '2099-01-02', v_branch, 'closed', true);
    INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
    VALUES (v_enr, 1, 1, 'paid', DATE '2099-01-02')
    RETURNING id INTO v_pay;
    INSERT INTO public.expenses (description, amount, date, branch_id, payment_method)
    VALUES ('prueba fix-044-i', 1, DATE '2099-01-02', v_branch, 'efectivo')
    RETURNING id INTO v_exp;

    v_err := 'sin error';
    BEGIN
      DELETE FROM public.payments WHERE id = v_pay;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 4, 'caso', 'AC-6 borrar pago de día cerrado',
      'esperado', 'CAJA_CERRADA', 'obtenido', v_err);

    v_err := 'sin error';
    BEGIN
      DELETE FROM public.expenses WHERE id = v_exp;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 5, 'caso', 'AC-6 borrar gasto de día cerrado',
      'esperado', 'CAJA_CERRADA', 'obtenido', v_err);
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  -- ── AC-6 (control): un gasto de un día SIN cierre sí se borra ─────────────
  BEGIN
    INSERT INTO public.expenses (description, amount, date, branch_id, payment_method)
    VALUES ('prueba fix-044-i', 1, DATE '2099-01-03', v_branch, 'efectivo')
    RETURNING id INTO v_exp;
    v_err := 'sin error';
    BEGIN
      DELETE FROM public.expenses WHERE id = v_exp;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 6,
      'caso', 'AC-6 control: gasto de día abierto se borra',
      'esperado', 'sin error', 'obtenido', v_err);
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  -- ── AC-4: un cierre 'closed' no se modifica ni se borra; un borrador sí ───
  BEGIN
    INSERT INTO public.cash_closings (date, branch_id, status, closed)
    VALUES (DATE '2099-01-04', v_branch, 'draft', false)
    RETURNING id INTO v_closing;

    v_err := 'sin error';
    BEGIN
      UPDATE public.cash_closings SET status = 'closed', closed = true WHERE id = v_closing;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 7, 'caso', 'AC-4 un borrador se puede cerrar',
      'esperado', 'sin error', 'obtenido', v_err);

    v_err := 'sin error';
    BEGIN
      UPDATE public.cash_closings SET total_income = 999 WHERE id = v_closing;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 8, 'caso', 'AC-4 modificar un cierre closed',
      'esperado', 'CIERRE_DEFINITIVO', 'obtenido', v_err);

    v_err := 'sin error';
    BEGIN
      INSERT INTO public.cash_closings (date, branch_id, status, closed)
      VALUES (DATE '2099-01-04', v_branch, 'draft', false)
      ON CONFLICT (date, branch_id_key) DO UPDATE SET status = EXCLUDED.status;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 9,
      'caso', 'AC-4 upsert de pestaña vieja sobre cierre closed',
      'esperado', 'CIERRE_DEFINITIVO', 'obtenido', v_err);

    v_err := 'sin error';
    BEGIN
      DELETE FROM public.cash_closings WHERE id = v_closing;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 10, 'caso', 'AC-4 borrar un cierre closed',
      'esperado', 'CIERRE_DEFINITIVO', 'obtenido', v_err);
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  INSERT INTO r044 (n, caso, esperado, obtenido)
  SELECT n, caso, esperado, obtenido
  FROM jsonb_to_recordset(v_rows) AS t(n int, caso text, esperado text, obtenido text);
END;
$test$;

SELECT n, caso, esperado, obtenido,
       CASE WHEN obtenido IS NOT DISTINCT FROM esperado THEN '✅' ELSE '❌' END AS resultado
FROM r044
ORDER BY n;
