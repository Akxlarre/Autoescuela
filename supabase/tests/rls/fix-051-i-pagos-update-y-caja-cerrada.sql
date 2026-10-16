-- ============================================================================
-- Test fix-051-i — solo el admin modifica pagos; no se registra un pago en un día con caja cerrada
-- Requiere la migración 20261015120000_fix051i_pagos_update_admin_y_caja_cerrada.sql aplicada.
-- Escribe como secretaria@test.com / admin@test.com (JWT simulado) en sub-bloques que SIEMPRE
-- abortan (ZZ001): no deja pagos ni cambios. Correr como postgres en el SQL Editor.
-- Todas las filas deben salir ✅.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r051;
CREATE TEMP TABLE r051 (n int, caso text, esperado text, obtenido text);

DO $test$
DECLARE
  v_rows   jsonb := '[]'::jsonb;
  v_sec    uuid;  v_branch int;
  v_adm    uuid;
  v_enr    int;
  v_pay    int;
  v_closed date;
  v_open   date;
  v_n      int;
  v_txt    text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT u.supabase_uid, u.branch_id INTO v_sec, v_branch
  FROM public.users u WHERE lower(u.email) = 'secretaria@test.com';
  SELECT u.supabase_uid INTO v_adm
  FROM public.users u WHERE lower(u.email) = 'admin@test.com';
  SELECT e.id INTO v_enr FROM public.enrollments e
  WHERE e.branch_id = v_branch AND e.status <> 'draft' AND e.pending_balance >= 2000
  ORDER BY e.id DESC LIMIT 1;
  SELECT p.id INTO v_pay FROM public.payments p
  JOIN public.enrollments e ON e.id = p.enrollment_id
  WHERE e.branch_id = v_branch AND p.status = 'paid'
  ORDER BY p.id DESC LIMIT 1;
  SELECT c.date INTO v_closed FROM public.cash_closings c
  WHERE c.branch_id = v_branch AND c.status = 'closed' ORDER BY c.date DESC LIMIT 1;
  -- Un día sin cierre en la sede: el primero libre desde mañana.
  SELECT d::date INTO v_open
  FROM generate_series(public.chile_today() + 1, public.chile_today() + 60, interval '1 day') d
  WHERE NOT EXISTS (SELECT 1 FROM public.cash_closings c WHERE c.date = d::date AND c.branch_id = v_branch)
  LIMIT 1;
  IF v_sec IS NULL OR v_adm IS NULL OR v_enr IS NULL OR v_pay IS NULL OR v_closed IS NULL THEN
    RAISE EXCEPTION 'Faltan usuarios de prueba, una matrícula con saldo, un pago o un cierre de caja en la sede';
  END IF;

  -- ── 1: la secretaria sube el monto de un pago ──
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.payments SET total_amount = total_amount + 1000 WHERE id = v_pay;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
            WHEN OTHERS THEN v_n := -1;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 1, 'caso', 'AC-F1 secretaria sube el monto de un pago: filas cambiadas',
    'esperado', '0', 'obtenido', v_n::text);

  -- ── 2: la secretaria pasa un pago a pending ──
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.payments SET status = 'pending' WHERE id = v_pay;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
            WHEN OTHERS THEN v_n := -1;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 2, 'caso', 'AC-F1 secretaria pasa un pago a pending: filas cambiadas',
    'esperado', '0', 'obtenido', v_n::text);

  -- ── 3: el admin sí modifica un pago ──
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.payments SET document_number = 'QA-051' WHERE id = v_pay;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
            WHEN OTHERS THEN v_n := -1;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 3, 'caso', 'AC-F1 admin modifica un pago: filas cambiadas',
    'esperado', '1', 'obtenido', v_n::text);

  -- ── 4-5: pago con fecha de un día con caja cerrada, secretaria y admin ──
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_txt := 'insertó';
    BEGIN
      INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
      VALUES (v_enr, 1000, 1000, 'paid', v_closed);
    EXCEPTION WHEN OTHERS THEN
      v_txt := CASE WHEN SQLERRM LIKE '%ya está cerrada%' THEN 'rechazado' ELSE 'otro error: ' || SQLERRM END;
    END;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 4, 'caso', 'AC-F2 secretaria registra un pago del ' || v_closed || ' (caja cerrada)',
    'esperado', 'rechazado', 'obtenido', v_txt);

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_txt := 'insertó';
    BEGIN
      INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
      VALUES (v_enr, 1000, 1000, 'paid', v_closed);
    EXCEPTION WHEN OTHERS THEN
      v_txt := CASE WHEN SQLERRM LIKE '%ya está cerrada%' THEN 'rechazado' ELSE 'otro error: ' || SQLERRM END;
    END;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 5, 'caso', 'AC-F2 admin registra un pago del ' || v_closed || ' (caja cerrada)',
    'esperado', 'rechazado', 'obtenido', v_txt);

  -- ── 6-7: pago pendiente (sin fecha) y pago de un día sin cierre ──
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_txt := 'insertó';
    BEGIN
      INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
      VALUES (v_enr, 1000, 1000, 'pending', NULL);
    EXCEPTION WHEN OTHERS THEN v_txt := 'rechazado: ' || SQLERRM;
    END;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 6, 'caso', 'AC-F3 secretaria registra un pago pendiente (sin fecha)',
    'esperado', 'insertó', 'obtenido', v_txt);

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_txt := 'insertó';
    BEGIN
      INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
      VALUES (v_enr, 1000, 1000, 'paid', v_open);
    EXCEPTION WHEN OTHERS THEN v_txt := 'rechazado: ' || SQLERRM;
    END;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 7, 'caso', 'AC-F3 secretaria registra un pago de un día sin cierre',
    'esperado', 'insertó', 'obtenido', v_txt);

  -- ── 8: sin usuario de sesión (como el pago online de una edge function) ──
  BEGIN
    PERFORM set_config('request.jwt.claims', '', true);
    v_txt := 'insertó';
    BEGIN
      INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
      VALUES (v_enr, 1000, 1000, 'paid', v_closed);
    EXCEPTION WHEN OTHERS THEN v_txt := 'rechazado: ' || SQLERRM;
    END;
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  v_rows := v_rows || jsonb_build_object('n', 8, 'caso', 'AC-F4 pago sin sesión de usuario (pago online) en día cerrado',
    'esperado', 'insertó', 'obtenido', v_txt);

  INSERT INTO r051 (n, caso, esperado, obtenido)
  SELECT n, caso, esperado, obtenido
  FROM jsonb_to_recordset(v_rows) AS t(n int, caso text, esperado text, obtenido text);
END;
$test$;

SELECT n, caso, esperado, obtenido,
       CASE WHEN obtenido IS NOT DISTINCT FROM esperado THEN '✅' ELSE '❌' END AS resultado
FROM r051
ORDER BY n;
