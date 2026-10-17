-- ============================================================================
-- Test fix-057-i — matrícula con beca del 100 %: no se registra pago y queda saldo 0 / paid_full
-- Requiere la migración 20261016180000_fix057i_matricula_becada_sin_pago.sql aplicada.
-- Escribe como secretaria@test.com (JWT simulado) en sub-bloques que SIEMPRE abortan (ZZ001):
-- no deja pagos, descuentos ni cambios en matrículas. Correr como postgres en el SQL Editor.
-- Todas las filas deben salir ✅.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r057;
CREATE TEMP TABLE r057 (n int, caso text, esperado text, obtenido text);

DO $test$
DECLARE
  v_rows   jsonb := '[]'::jsonb;
  v_sec    uuid;  v_branch int;
  v_enr    int;
  v_disc   int;
  v_txt    text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT u.supabase_uid, u.branch_id INTO v_sec, v_branch
  FROM public.users u WHERE lower(u.email) = 'secretaria@test.com';
  SELECT e.id INTO v_enr FROM public.enrollments e
  WHERE e.branch_id = v_branch AND e.base_price > 20000
  ORDER BY e.id DESC LIMIT 1;
  SELECT d.id INTO v_disc FROM public.discounts d ORDER BY d.id LIMIT 1;
  IF v_sec IS NULL OR v_enr IS NULL THEN
    RAISE EXCEPTION 'Faltan secretaria@test.com o una matrícula en su sede';
  END IF;

  -- ── 1: beca 100 %, sin medio de pago ──
  BEGIN
    UPDATE public.enrollments SET status = 'draft' WHERE id = v_enr;
    DELETE FROM public.discount_applications WHERE enrollment_id = v_enr;
    DELETE FROM public.payments WHERE enrollment_id = v_enr;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_enrollment_payment(v_enr, NULL, 0, v_disc,
      (SELECT base_price FROM public.enrollments WHERE id = v_enr), false, NULL);
    EXECUTE 'RESET ROLE';

    SELECT (SELECT count(*) FROM public.payments p WHERE p.enrollment_id = e.id) || ' / ' ||
           e.pending_balance || ' / ' || e.total_paid || ' / ' || e.payment_status
    INTO v_txt FROM public.enrollments e WHERE e.id = v_enr;
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
            WHEN OTHERS THEN v_txt := 'error: ' || SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 1,
    'caso', 'AC-F2 beca 100 %: pagos / saldo / pagado / estado',
    'esperado', '0 / 0 / 0 / paid_full', 'obtenido', COALESCE(v_txt, '?'));

  -- ── 2: volver al paso Pago tras un abono y quedar becado: el abono anterior se reemplaza ──
  BEGIN
    UPDATE public.enrollments SET status = 'draft' WHERE id = v_enr;
    DELETE FROM public.discount_applications WHERE enrollment_id = v_enr;
    DELETE FROM public.payments WHERE enrollment_id = v_enr;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_enrollment_payment(v_enr, 'efectivo', 10000, NULL, 0, true, 'B-1');
    PERFORM public.record_enrollment_payment(v_enr, NULL, 0, v_disc,
      (SELECT base_price FROM public.enrollments WHERE id = v_enr), false, NULL);
    EXECUTE 'RESET ROLE';

    SELECT (SELECT count(*) FROM public.payments p WHERE p.enrollment_id = e.id) || ' / ' ||
           e.pending_balance || ' / ' || e.payment_status
    INTO v_txt FROM public.enrollments e WHERE e.id = v_enr;
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
            WHEN OTHERS THEN v_txt := 'error: ' || SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 2,
    'caso', 'Abono y luego beca 100 %: pagos / saldo / estado',
    'esperado', '0 / 0 / paid_full', 'obtenido', COALESCE(v_txt, '?'));

  -- ── 3: con monto > 0 sigue igual que fix-050-i ──
  BEGIN
    UPDATE public.enrollments SET status = 'draft' WHERE id = v_enr;
    DELETE FROM public.discount_applications WHERE enrollment_id = v_enr;
    DELETE FROM public.payments WHERE enrollment_id = v_enr;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_enrollment_payment(v_enr, 'efectivo', 10000, NULL, 0, true, 'B-1');
    EXECUTE 'RESET ROLE';

    SELECT (SELECT count(*) FROM public.payments p WHERE p.enrollment_id = e.id) || ' / ' ||
           (e.pending_balance = e.base_price - 10000) || ' / ' || e.payment_status
    INTO v_txt FROM public.enrollments e WHERE e.id = v_enr;
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
            WHEN OTHERS THEN v_txt := 'error: ' || SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 3,
    'caso', 'AC-F4 abono de $10.000: pagos / saldo baja 10.000 / estado',
    'esperado', '1 / true / partial', 'obtenido', COALESCE(v_txt, '?'));

  -- ── 4: monto > 0 sin medio de pago sigue rechazado ──
  BEGIN
    UPDATE public.enrollments SET status = 'draft' WHERE id = v_enr;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_txt := 'aceptado';
    BEGIN
      PERFORM public.record_enrollment_payment(v_enr, NULL, 10000, NULL, 0, true, NULL);
    EXCEPTION WHEN OTHERS THEN v_txt := 'rechazado';
    END;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 4, 'caso', 'Monto > 0 sin medio de pago',
    'esperado', 'rechazado', 'obtenido', v_txt);

  INSERT INTO r057 (n, caso, esperado, obtenido)
  SELECT n, caso, esperado, obtenido
  FROM jsonb_to_recordset(v_rows) AS t(n int, caso text, esperado text, obtenido text);
END;
$test$;

SELECT n, caso, esperado, obtenido,
       CASE WHEN obtenido IS NOT DISTINCT FROM esperado THEN '✅' ELSE '❌' END AS resultado
FROM r057
ORDER BY n;
