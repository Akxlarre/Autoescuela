-- ============================================================================
-- Testing fix-048-i (ASG-i-028) — Bloque 2 · Parte B: reglas de la BD al registrar un pago
-- Checklist: specs/testing-piloto/028-pagos-descuentos.md (H03, G04, G11, B2-2, H11, H14, H15).
-- Escribe como secretaria@test.com (JWT simulado) en sub-bloques que SIEMPRE abortan (ZZ001):
-- no deja pagos, saldos ni filas de auditoría. Correr como postgres en el SQL Editor.
-- Las filas con esperado "¿?" son preguntas abiertas (se reporta lo que pasa).
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.rb2;
CREATE TEMP TABLE rb2 (n int, caso text, esperado text, obtenido text);

DO $test$
DECLARE
  v_rows    jsonb := '[]'::jsonb;
  v_sec     uuid;  v_secId int;  v_branch int;
  v_enr     int;   v_saldo int;
  v_closed  date;
  v_pay     int;
  v_n       int;
  v_bal     int;
  v_err     text;
  v_txt     text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT u.supabase_uid, u.id, u.branch_id INTO v_sec, v_secId, v_branch
  FROM public.users u WHERE lower(u.email) = 'secretaria@test.com';
  SELECT e.id, e.pending_balance INTO v_enr, v_saldo FROM public.enrollments e
  WHERE e.branch_id = v_branch AND e.status <> 'draft' AND e.pending_balance >= 2000
  ORDER BY e.id DESC LIMIT 1;
  SELECT c.date INTO v_closed FROM public.cash_closings c
  WHERE c.branch_id = v_branch AND c.status = 'closed' ORDER BY c.date DESC LIMIT 1;
  IF v_sec IS NULL OR v_enr IS NULL THEN RAISE EXCEPTION 'Faltan secretaria@test.com o una matrícula con saldo en su sede'; END IF;

  -- ── H03: sobrepago saltando la UI (saldo + 1) ───────────────────────────────
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_err := 'insertó';
    BEGIN
      INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
      VALUES (v_enr, v_saldo + 1, v_saldo + 1, 'paid', public.chile_today());
    EXCEPTION WHEN OTHERS THEN v_err := 'rechazado';
    END;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 1, 'caso', 'H03 pago de saldo + $1 por consola',
    'esperado', 'rechazado', 'obtenido', v_err);

  -- ── G12 (BD): pago exacto al saldo ──────────────────────────────────────────
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_err := 'insertó';
    BEGIN
      INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
      VALUES (v_enr, v_saldo, v_saldo, 'paid', public.chile_today());
    EXCEPTION WHEN OTHERS THEN v_err := 'rechazado: ' || SQLERRM;
    END;
    EXECUTE 'RESET ROLE';
    SELECT pending_balance INTO v_bal FROM public.enrollments WHERE id = v_enr;
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 2, 'caso', 'G12/H02 pago exacto al saldo: se acepta y el saldo queda en 0',
    'esperado', 'insertó, saldo 0', 'obtenido', v_err || ', saldo ' || COALESCE(v_bal::text, '?'));

  -- ── G04: pago con fecha de un día cuya caja está cerrada ────────────────────
  v_txt := 'sin cierre de caja en la sede';
  IF v_closed IS NOT NULL THEN
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      v_txt := 'permitido';
      BEGIN
        INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
        VALUES (v_enr, 1000, 1000, 'paid', v_closed);
      EXCEPTION WHEN OTHERS THEN v_txt := 'rechazado: ' || SQLERRM;
      END;
      EXECUTE 'RESET ROLE';
      RAISE EXCEPTION USING ERRCODE = 'ZZ001';
    EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
    END;
    EXECUTE 'RESET ROLE';
  END IF;
  v_rows := v_rows || jsonb_build_object('n', 3,
    'caso', 'G04 pago con fecha de un día con caja cerrada (' || COALESCE(v_closed::text, '-') || ')',
    'esperado', '¿?', 'obtenido', v_txt);

  -- ── B2-2: ¿qué hace la BD con un monto con decimales, como lo manda la API? ──
  -- PostgREST convierte el JSON a la fila con json_populate_record: se reproduce igual.
  v_txt := 'aceptado';
  BEGIN
    SELECT (json_populate_record(NULL::public.payments, '{"total_amount": 1000.5}')).total_amount INTO v_n;
    v_txt := 'aceptado como ' || v_n;
  EXCEPTION WHEN OTHERS THEN v_txt := 'rechazado: ' || SQLERRM;
  END;
  v_rows := v_rows || jsonb_build_object('n', 4, 'caso', 'B2-2 monto 1000.5 llegando por la API',
    'esperado', '¿?', 'obtenido', v_txt);

  -- ── H11: un pago 'pending' no baja el saldo (regresión 0010-i AC-E2) ─────────
  BEGIN
    SELECT e.base_price - e.discount - COALESCE((SELECT SUM(p.total_amount) FROM public.payments p
             WHERE p.enrollment_id = e.id AND p.status = 'paid'), 0)
    INTO v_n FROM public.enrollments e WHERE e.id = v_enr;
    INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status)
    VALUES (v_enr, 1000, 1000, 'pending');
    SELECT pending_balance INTO v_bal FROM public.enrollments WHERE id = v_enr;
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
            WHEN OTHERS THEN v_bal := NULL;
  END;
  v_rows := v_rows || jsonb_build_object('n', 5, 'caso', 'H11 pago "pending" no baja el saldo',
    'esperado', v_n::text, 'obtenido', COALESCE(v_bal::text, 'error'));

  -- ── H14 / H15: auditoría y "registrado por" de un pago hecho por la secretaria ─
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
    VALUES (v_enr, 1000, 1000, 'paid', public.chile_today())
    RETURNING id INTO v_pay;
    EXECUTE 'RESET ROLE';
    SELECT count(*) INTO v_n FROM public.audit_log
    WHERE entity = 'payments' AND entity_id = v_pay AND action = 'INSERT' AND user_id = v_secId;
    SELECT COALESCE(registered_by::text, 'vacío') INTO v_txt FROM public.payments WHERE id = v_pay;
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
            WHEN OTHERS THEN v_n := -1; v_txt := 'error: ' || SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 6, 'caso', 'H14 auditoría del INSERT con la secretaria como autora',
    'esperado', '1', 'obtenido', v_n::text);
  v_rows := v_rows || jsonb_build_object('n', 7, 'caso', 'H15 payments.registered_by de un pago por API',
    'esperado', '¿?', 'obtenido', v_txt);

  INSERT INTO rb2 (n, caso, esperado, obtenido)
  SELECT n, caso, esperado, obtenido
  FROM jsonb_to_recordset(v_rows) AS t(n int, caso text, esperado text, obtenido text);
END;
$test$;

SELECT n, caso, esperado, obtenido,
       CASE WHEN esperado = '¿?' THEN 'pregunta'
            WHEN obtenido IS NOT DISTINCT FROM esperado THEN '✅' ELSE '❌' END AS resultado
FROM rb2
ORDER BY n;
