-- ============================================================================
-- Test fix-050-i — record_enrollment_payment(): el paso Pago del wizard no duplica el pago
-- Requiere la migración 20261014180000_fix050i_record_enrollment_payment.sql aplicada.
-- Escribe como secretaria@test.com / secretaria2@test.com (JWT simulado) en sub-bloques que
-- SIEMPRE abortan (ZZ001): no deja pagos, descuentos ni cambios en matrículas.
-- Correr como postgres en el SQL Editor. Todas las filas deben salir ✅.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r050;
CREATE TEMP TABLE r050 (n int, caso text, esperado text, obtenido text);

DO $test$
DECLARE
  v_rows   jsonb := '[]'::jsonb;
  v_sec    uuid;  v_secId int;  v_branch int;
  v_sec2   uuid;
  v_enr    int;
  v_disc   int;
  v_n      int;   v_d int;
  v_txt    text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT u.supabase_uid, u.id, u.branch_id INTO v_sec, v_secId, v_branch
  FROM public.users u WHERE lower(u.email) = 'secretaria@test.com';
  SELECT u.supabase_uid INTO v_sec2
  FROM public.users u WHERE lower(u.email) = 'secretaria2@test.com';
  SELECT e.id INTO v_enr FROM public.enrollments e
  WHERE e.branch_id = v_branch AND e.pending_balance >= 30000
  ORDER BY e.id DESC LIMIT 1;
  SELECT d.id INTO v_disc FROM public.discounts d ORDER BY d.id LIMIT 1;
  IF v_sec IS NULL OR v_sec2 IS NULL OR v_enr IS NULL THEN
    RAISE EXCEPTION 'Faltan secretaria@test.com, secretaria2@test.com o una matrícula en su sede';
  END IF;

  -- ── 1-3: la secretaria guarda el paso Pago dos veces sobre una matrícula en borrador ──
  BEGIN
    -- La matrícula queda en borrador y sin pago de matrícula previo (se revierte al final).
    UPDATE public.enrollments SET status = 'draft' WHERE id = v_enr;
    DELETE FROM public.discount_applications WHERE enrollment_id = v_enr;
    DELETE FROM public.payments WHERE enrollment_id = v_enr AND type = 'enrollment';

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_enrollment_payment(v_enr, 'efectivo', 10000, v_disc, 5000, true, 'B-1');
    PERFORM public.record_enrollment_payment(v_enr, 'efectivo', 12000, v_disc, 5000, true, 'B-2');
    EXECUTE 'RESET ROLE';

    SELECT count(*) INTO v_n FROM public.payments WHERE enrollment_id = v_enr AND type = 'enrollment';
    SELECT count(*) INTO v_d FROM public.discount_applications WHERE enrollment_id = v_enr;
    SELECT p.total_amount || ' / ' || p.document_number || ' / ' ||
           (p.payment_date = public.chile_today()) || ' / ' || (p.registered_by = v_secId)
    INTO v_txt FROM public.payments p WHERE p.enrollment_id = v_enr AND p.type = 'enrollment';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
            WHEN OTHERS THEN v_n := -1; v_d := -1; v_txt := 'error: ' || SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 1, 'caso', 'AC-F1 secretaria guarda 2 veces: pagos de matrícula',
    'esperado', '1', 'obtenido', v_n::text);
  v_rows := v_rows || jsonb_build_object('n', 2, 'caso', 'AC-F1 secretaria guarda 2 veces: descuentos aplicados',
    'esperado', CASE WHEN v_disc IS NULL THEN '0' ELSE '1' END, 'obtenido', v_d::text);
  v_rows := v_rows || jsonb_build_object('n', 3,
    'caso', 'AC-F4 queda el último pago: monto / boleta / fecha de hoy en Chile / registrado por la secretaria',
    'esperado', '12000 / B-2 / true / true', 'obtenido', COALESCE(v_txt, '?'));

  -- ── 4: "Cobrar después" no descuenta el saldo ──
  BEGIN
    UPDATE public.enrollments SET status = 'draft' WHERE id = v_enr;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_enrollment_payment(v_enr, 'pendiente', 10000, NULL, 0, false, NULL);
    EXECUTE 'RESET ROLE';
    -- El saldo solo descuenta los pagos 'paid' (otros abonos, si los hay): el pendiente no cuenta.
    SELECT (e.pending_balance = e.base_price - e.discount - COALESCE((SELECT sum(p.total_amount)
              FROM public.payments p WHERE p.enrollment_id = e.id AND p.status = 'paid'), 0))::text
           || ' / ' || (SELECT p.status FROM public.payments p
                        WHERE p.enrollment_id = e.id AND p.type = 'enrollment')
    INTO v_txt FROM public.enrollments e WHERE e.id = v_enr;
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
            WHEN OTHERS THEN v_txt := 'error: ' || SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 4, 'caso', '"Cobrar después": el saldo no baja / estado del pago',
    'esperado', 'true / pending', 'obtenido', COALESCE(v_txt, '?'));

  -- ── 5: reintentar sin el descuento acepta el pago por el precio completo ──
  BEGIN
    UPDATE public.enrollments SET status = 'draft' WHERE id = v_enr;
    DELETE FROM public.payments WHERE enrollment_id = v_enr AND type <> 'enrollment' AND status = 'paid';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_txt := 'aceptado';
    BEGIN
      PERFORM public.record_enrollment_payment(v_enr, 'efectivo', (SELECT base_price - 5000 FROM public.enrollments WHERE id = v_enr), v_disc, 5000, false, NULL);
      PERFORM public.record_enrollment_payment(v_enr, 'efectivo', (SELECT base_price FROM public.enrollments WHERE id = v_enr), NULL, 0, false, NULL);
    EXCEPTION WHEN OTHERS THEN v_txt := 'rechazado: ' || SQLERRM;
    END;
    EXECUTE 'RESET ROLE';
    IF v_txt = 'aceptado' THEN
      SELECT v_txt || ' / ' || e.pending_balance || ' / ' || e.payment_status INTO v_txt
      FROM public.enrollments e WHERE e.id = v_enr;
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
            WHEN OTHERS THEN v_txt := 'error: ' || SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 5, 'caso', 'Reintentar sin descuento: pago completo / saldo / estado',
    'esperado', 'aceptado / 0 / paid_full', 'obtenido', COALESCE(v_txt, '?'));

  -- ── 6: una matrícula activa no se toca ──
  BEGIN
    UPDATE public.enrollments SET status = 'active' WHERE id = v_enr;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_txt := 'aceptado';
    BEGIN
      PERFORM public.record_enrollment_payment(v_enr, 'efectivo', 1000, NULL, 0, true, NULL);
    EXCEPTION WHEN OTHERS THEN v_txt := 'rechazado';
    END;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 6, 'caso', 'AC-F3 matrícula activa',
    'esperado', 'rechazado', 'obtenido', v_txt);

  -- ── 7: secretaria de otra sede ──
  BEGIN
    UPDATE public.enrollments SET status = 'draft' WHERE id = v_enr;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec2, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_txt := 'aceptado';
    BEGIN
      PERFORM public.record_enrollment_payment(v_enr, 'efectivo', 1000, NULL, 0, true, NULL);
    EXCEPTION WHEN OTHERS THEN v_txt := 'rechazado';
    END;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 7, 'caso', 'AC-F3 secretaria de otra sede',
    'esperado', 'rechazado', 'obtenido', v_txt);

  -- ── 8: si el pago nuevo falla, el anterior queda intacto (atómico) ──
  BEGIN
    UPDATE public.enrollments SET status = 'draft' WHERE id = v_enr;
    DELETE FROM public.discount_applications WHERE enrollment_id = v_enr;
    DELETE FROM public.payments WHERE enrollment_id = v_enr AND type = 'enrollment';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_enrollment_payment(v_enr, 'efectivo', 10000, NULL, 0, true, 'B-1');
    BEGIN
      PERFORM public.record_enrollment_payment(v_enr, 'cheque', 10000, NULL, 0, true, 'B-2');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    EXECUTE 'RESET ROLE';
    SELECT count(*) || ' / ' || max(document_number) INTO v_txt
    FROM public.payments WHERE enrollment_id = v_enr AND type = 'enrollment';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
            WHEN OTHERS THEN v_txt := 'error: ' || SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 8, 'caso', 'AC-F2 un segundo guardado inválido no borra el primero',
    'esperado', '1 / B-1', 'obtenido', COALESCE(v_txt, '?'));

  -- ── 9: anon no puede ejecutarla ──
  SELECT CASE WHEN has_function_privilege('anon',
    'public.record_enrollment_payment(integer, text, integer, integer, integer, boolean, text)', 'EXECUTE')
    THEN 'sí' ELSE 'no' END INTO v_txt;
  v_rows := v_rows || jsonb_build_object('n', 9, 'caso', 'anon puede ejecutar la RPC',
    'esperado', 'no', 'obtenido', v_txt);

  INSERT INTO r050 (n, caso, esperado, obtenido)
  SELECT n, caso, esperado, obtenido
  FROM jsonb_to_recordset(v_rows) AS t(n int, caso text, esperado text, obtenido text);
END;
$test$;

SELECT n, caso, esperado, obtenido,
       CASE WHEN obtenido IS NOT DISTINCT FROM esperado THEN '✅' ELSE '❌' END AS resultado
FROM r050
ORDER BY n;
