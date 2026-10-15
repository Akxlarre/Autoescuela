-- ============================================================================
-- Testing fix-048-i (ASG-i-028) — Bloque 1: seguridad de pagos entre sedes
-- Checklist: specs/testing-piloto/028-pagos-descuentos.md (O07, O08, O09, S5) + regresión 0025-m.
-- Corre como secretaria@test.com (sede A) y secretaria2@test.com (sede B) simulando su JWT.
-- Todo lo que escribe corre en sub-bloques que SIEMPRE abortan (ZZ001): no deja pagos ni cambios.
-- Correr como postgres en el SQL Editor. Resultado: último SELECT ("obtenido" vs "esperado").
-- Las filas con esperado "¿?" son preguntas abiertas: se reporta lo que pasa, sin ✅/❌.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.rb1;
CREATE TEMP TABLE rb1 (n int, caso text, esperado text, obtenido text);

DO $test$
DECLARE
  v_rows    jsonb := '[]'::jsonb;
  v_secA    uuid;  v_branchA int;  v_bothA boolean;
  v_secB    uuid;  v_branchB int;
  v_enrA    int;   -- matrícula de la sede A con saldo
  v_enrB    int;   -- matrícula de la sede B con saldo
  v_payA    int;   -- pago 'paid' de la sede A
  v_payB    int;   -- pago 'paid' de la sede B
  v_n       int;
  v_err     text;
  v_txt     text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT u.supabase_uid, u.branch_id INTO v_secA, v_branchA
  FROM public.users u WHERE lower(u.email) = 'secretaria@test.com';
  SELECT u.supabase_uid, u.branch_id INTO v_secB, v_branchB
  FROM public.users u WHERE lower(u.email) = 'secretaria2@test.com';
  IF v_secA IS NULL OR v_secB IS NULL OR v_branchA IS NOT DISTINCT FROM v_branchB THEN
    RAISE EXCEPTION 'Faltan secretaria@test.com y secretaria2@test.com en sedes distintas';
  END IF;

  SELECT e.id INTO v_enrA FROM public.enrollments e
  WHERE e.branch_id = v_branchA AND e.status <> 'draft' AND e.pending_balance >= 2000
  ORDER BY e.id DESC LIMIT 1;
  SELECT e.id INTO v_enrB FROM public.enrollments e
  WHERE e.branch_id = v_branchB AND e.status <> 'draft' AND e.pending_balance >= 2000
  ORDER BY e.id DESC LIMIT 1;
  SELECT p.id INTO v_payA FROM public.payments p JOIN public.enrollments e ON e.id = p.enrollment_id
  WHERE e.branch_id = v_branchA AND p.status = 'paid' ORDER BY p.id DESC LIMIT 1;
  SELECT p.id INTO v_payB FROM public.payments p JOIN public.enrollments e ON e.id = p.enrollment_id
  WHERE e.branch_id = v_branchB AND p.status = 'paid' ORDER BY p.id DESC LIMIT 1;

  -- ── 0. ¿La secretaria A tiene permiso de ambas sedes? (cambia lo esperado) ──
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_secA, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_bothA := (SELECT public.auth_can_access_both_branches());
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 0, 'caso', 'Secretaria A tiene permiso de ambas sedes',
    'esperado', 'false', 'obtenido', COALESCE(v_bothA::text, 'null'));

  -- ── O07 / S5: la secretaria A no lee pagos de la sede B ─────────────────────
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_secA, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO v_n FROM public.payments p
    WHERE p.enrollment_id IN (SELECT id FROM public.enrollments WHERE branch_id = v_branchB);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 1, 'caso', 'O07 secretaria A lee pagos de la sede B',
    'esperado', '0', 'obtenido', v_n::text);

  -- ── O07 control: la secretaria A sí lee pagos de su sede ─────────────────────
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_secA, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO v_n FROM public.payments WHERE id = v_payA;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 2, 'caso', 'O07 control: secretaria A lee un pago de su sede',
    'esperado', '1', 'obtenido', v_n::text);

  -- ── O08 / S5: la secretaria A no inserta un pago en una matrícula de la sede B ─
  v_err := 'sin matrícula B con saldo';
  IF v_enrB IS NOT NULL THEN
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_secA, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      v_err := 'insertó';
      BEGIN
        INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
        VALUES (v_enrB, 1000, 1000, 'paid', public.chile_today());
      EXCEPTION WHEN OTHERS THEN v_err := 'rechazado';
      END;
      EXECUTE 'RESET ROLE';
      RAISE EXCEPTION USING ERRCODE = 'ZZ001';
    EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
    END;
    EXECUTE 'RESET ROLE';
  END IF;
  v_rows := v_rows || jsonb_build_object('n', 3, 'caso', 'O08 secretaria A inserta pago en matrícula de la sede B',
    'esperado', 'rechazado', 'obtenido', v_err);

  -- ── O08 control: la secretaria A sí inserta en su sede ───────────────────────
  v_err := 'sin matrícula A con saldo';
  IF v_enrA IS NOT NULL THEN
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_secA, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      v_err := 'insertó';
      BEGIN
        INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
        VALUES (v_enrA, 1000, 1000, 'paid', public.chile_today());
      EXCEPTION WHEN OTHERS THEN v_err := 'rechazado: ' || SQLERRM;
      END;
      EXECUTE 'RESET ROLE';
      RAISE EXCEPTION USING ERRCODE = 'ZZ001';
    EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
    END;
    EXECUTE 'RESET ROLE';
  END IF;
  v_rows := v_rows || jsonb_build_object('n', 4, 'caso', 'O08 control: secretaria A inserta pago en su sede',
    'esperado', 'insertó', 'obtenido', v_err);

  -- ── O09: la secretaria A modifica un pago de la sede B ───────────────────────
  v_txt := 'sin pago B';
  IF v_payB IS NOT NULL THEN
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_secA, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      UPDATE public.payments SET document_number = 'QA-B1' WHERE id = v_payB;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_txt := v_n || ' filas';
      EXECUTE 'RESET ROLE';
      RAISE EXCEPTION USING ERRCODE = 'ZZ001';
    EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
              WHEN OTHERS THEN v_txt := 'rechazado';
    END;
    EXECUTE 'RESET ROLE';
  END IF;
  v_rows := v_rows || jsonb_build_object('n', 5, 'caso', 'O09 secretaria A modifica un pago de la sede B',
    'esperado', '0 filas', 'obtenido', v_txt);

  -- ── O09 (pregunta abierta): la secretaria A cambia el MONTO de un pago de su sede ─
  v_txt := 'sin pago A';
  IF v_payA IS NOT NULL THEN
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_secA, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      v_txt := 'permitido';
      BEGIN
        UPDATE public.payments SET total_amount = total_amount + 1000000, cash_amount = cash_amount + 1000000
        WHERE id = v_payA;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        IF v_n = 0 THEN v_txt := '0 filas'; END IF;
      EXCEPTION WHEN OTHERS THEN v_txt := 'rechazado: ' || SQLERRM;
      END;
      EXECUTE 'RESET ROLE';
      RAISE EXCEPTION USING ERRCODE = 'ZZ001';
    EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
    END;
    EXECUTE 'RESET ROLE';
  END IF;
  v_rows := v_rows || jsonb_build_object('n', 6,
    'caso', 'O09 secretaria A sube en $1.000.000 el monto de un pago de su sede (¿sobrepago por UPDATE?)',
    'esperado', '¿?', 'obtenido', v_txt);

  -- ── O09 (pregunta abierta): la secretaria A pasa un pago de su sede a 'pending' ─
  v_txt := 'sin pago A';
  IF v_payA IS NOT NULL THEN
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_secA, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      v_txt := 'permitido';
      BEGIN
        UPDATE public.payments SET status = 'pending' WHERE id = v_payA;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        IF v_n = 0 THEN v_txt := '0 filas'; END IF;
      EXCEPTION WHEN OTHERS THEN v_txt := 'rechazado: ' || SQLERRM;
      END;
      EXECUTE 'RESET ROLE';
      RAISE EXCEPTION USING ERRCODE = 'ZZ001';
    EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
    END;
    EXECUTE 'RESET ROLE';
  END IF;
  v_rows := v_rows || jsonb_build_object('n', 7,
    'caso', 'O09 secretaria A pasa un pago de su sede a "pending" (lo saca del saldo sin anular)',
    'esperado', '¿?', 'obtenido', v_txt);

  -- ── Regresión 0025-m: la secretaria no anula ────────────────────────────────
  v_err := 'sin pago A';
  IF v_payA IS NOT NULL THEN
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_secA, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      v_err := 'anuló';
      BEGIN
        UPDATE public.payments SET status = 'anulado', void_reason = 'Prueba fix-048-i' WHERE id = v_payA;
      EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
      END;
      EXECUTE 'RESET ROLE';
      RAISE EXCEPTION USING ERRCODE = 'ZZ001';
    EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
    END;
    EXECUTE 'RESET ROLE';
  END IF;
  v_rows := v_rows || jsonb_build_object('n', 8, 'caso', 'Regresión 0025-m: secretaria intenta anular un pago',
    'esperado', 'ANULAR_SOLO_ADMIN', 'obtenido', v_err);

  -- ── Regresión: la secretaria no borra pagos ─────────────────────────────────
  v_txt := 'sin pago A';
  IF v_payA IS NOT NULL THEN
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_secA, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      v_txt := 'borró';
      BEGIN
        DELETE FROM public.payments WHERE id = v_payA;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        IF v_n = 0 THEN v_txt := 'no borra'; END IF;
      EXCEPTION WHEN OTHERS THEN v_txt := 'no borra';
      END;
      EXECUTE 'RESET ROLE';
      RAISE EXCEPTION USING ERRCODE = 'ZZ001';
    EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
    END;
    EXECUTE 'RESET ROLE';
  END IF;
  v_rows := v_rows || jsonb_build_object('n', 9, 'caso', 'Regresión: secretaria intenta borrar un pago de su sede',
    'esperado', 'no borra', 'obtenido', v_txt);

  INSERT INTO rb1 (n, caso, esperado, obtenido)
  SELECT n, caso, esperado, obtenido
  FROM jsonb_to_recordset(v_rows) AS t(n int, caso text, esperado text, obtenido text);
END;
$test$;

SELECT n, caso, esperado, obtenido,
       CASE WHEN esperado = '¿?' THEN 'pregunta'
            WHEN obtenido IS NOT DISTINCT FROM esperado THEN '✅' ELSE '❌' END AS resultado
FROM rb1
ORDER BY n;
