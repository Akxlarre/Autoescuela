-- ============================================================================
-- Testing fix-048-i (ASG-i-028) — Bloque 4: descuentos, pago de matrícula y avisos
-- Checklist: specs/testing-piloto/028-pagos-descuentos.md (L03, L11, L13, M05, M12/S13, N01–N04).
-- Lo que escribe corre en sub-bloques que SIEMPRE abortan (ZZ001): no deja datos.
-- Las filas 7–9 solo LEEN datos que ya existen. Correr como postgres en el SQL Editor.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.rb4;
CREATE TEMP TABLE rb4 (n int, caso text, esperado text, obtenido text);

DO $test$
DECLARE
  v_rows   jsonb := '[]'::jsonb;
  v_sec    uuid;  v_branch int;
  v_enr    int;   v_pay int;
  v_n      int;
  v_err    text;
  v_txt    text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT u.supabase_uid, u.branch_id INTO v_sec, v_branch
  FROM public.users u WHERE lower(u.email) = 'secretaria@test.com';
  SELECT e.id INTO v_enr FROM public.enrollments e
  WHERE e.branch_id = v_branch AND e.status <> 'draft' AND e.pending_balance >= 2000
  ORDER BY e.id DESC LIMIT 1;

  -- ── L03: la secretaria crea un descuento por consola ────────────────────────
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_err := 'creó';
    BEGIN
      INSERT INTO public.discounts (name, discount_type, value, valid_from, applicable_to, status)
      VALUES ('QA-048 descuento', 'percentage', 10, public.chile_today(), 'class_b', 'active');
    EXCEPTION WHEN OTHERS THEN v_err := 'rechazado';
    END;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 1, 'caso', 'L03 secretaria crea un descuento por consola',
    'esperado', 'rechazado', 'obtenido', v_err);

  -- ── L13: "vigente hasta" anterior a "vigente desde" ─────────────────────────
  BEGIN
    v_txt := 'permitido';
    BEGIN
      INSERT INTO public.discounts (name, discount_type, value, valid_from, valid_until, applicable_to, status)
      VALUES ('QA-048 fechas', 'percentage', 10, DATE '2026-12-01', DATE '2026-11-01', 'class_b', 'active');
    EXCEPTION WHEN OTHERS THEN v_txt := 'rechazado: ' || SQLERRM;
    END;
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  v_rows := v_rows || jsonb_build_object('n', 2, 'caso', 'L13 descuento con "hasta" (01-11) antes de "desde" (01-12)',
    'esperado', '¿?', 'obtenido', v_txt);

  -- ── L11: porcentaje 12,5 como llega por la API ──────────────────────────────
  BEGIN
    SELECT (json_populate_record(NULL::public.discounts, '{"value": 12.5}')).value INTO v_n;
    v_txt := 'aceptado como ' || v_n;
  EXCEPTION WHEN OTHERS THEN v_txt := 'rechazado: ' || SQLERRM;
  END;
  v_rows := v_rows || jsonb_build_object('n', 3, 'caso', 'L11 descuento de 12,5% llegando por la API',
    'esperado', '¿?', 'obtenido', v_txt);

  -- ── M05: pago de matrícula de $0 (descuento del 100%) ───────────────────────
  BEGIN
    v_err := 'insertó';
    BEGIN
      INSERT INTO public.payments (enrollment_id, type, total_amount, cash_amount, status, payment_date)
      VALUES (v_enr, 'enrollment', 0, 0, 'paid', public.chile_today());
    EXCEPTION WHEN OTHERS THEN v_err := 'rechazado: ' || SQLERRM;
    END;
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  v_rows := v_rows || jsonb_build_object('n', 4, 'caso', 'M05 pago de matrícula de $0 (descuento 100%)',
    'esperado', '¿?', 'obtenido', v_err);

  -- ── M12 / S13: la secretaria "borra" el pago de matrícula anterior ──────────
  -- recordPayment() borra el pago previo y solo revisa `error`. Si la RLS filtra el DELETE sin
  -- error (0 filas), el código sigue e inserta un segundo pago.
  BEGIN
    INSERT INTO public.payments (enrollment_id, type, total_amount, cash_amount, status)
    VALUES (v_enr, 'enrollment', 1000, 1000, 'pending')
    RETURNING id INTO v_pay;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_txt := 'error';
    BEGIN
      DELETE FROM public.payments WHERE enrollment_id = v_enr AND type = 'enrollment';
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_txt := 'sin error, ' || v_n || ' filas borradas';
    EXCEPTION WHEN OTHERS THEN v_txt := 'error: ' || SQLERRM;
    END;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 5,
    'caso', 'S13 secretaria borra el pago de matrícula anterior (como hace recordPayment al reintentar)',
    'esperado', '¿?', 'obtenido', v_txt);

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_txt := 'error';
    BEGIN
      DELETE FROM public.discount_applications WHERE enrollment_id = v_enr;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_txt := 'sin error, ' || v_n || ' filas borradas';
    EXCEPTION WHEN OTHERS THEN v_txt := 'error: ' || SQLERRM;
    END;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 6, 'caso', 'S13 secretaria borra descuentos aplicados de la matrícula',
    'esperado', '¿?', 'obtenido', v_txt);

  -- ── Evidencia en los datos (solo lectura) ───────────────────────────────────
  SELECT count(*), string_agg(enrollment_id::text, ', ' ORDER BY enrollment_id) INTO v_n, v_txt
  FROM (
    SELECT p.enrollment_id FROM public.payments p
    WHERE p.type = 'enrollment' AND p.status IS DISTINCT FROM 'anulado'
    GROUP BY p.enrollment_id HAVING count(*) > 1
  ) d;
  v_rows := v_rows || jsonb_build_object('n', 7, 'caso', 'S13 matrículas con más de un pago de matrícula vigente',
    'esperado', '0', 'obtenido', v_n || COALESCE(' (' || v_txt || ')', ''));

  SELECT string_agg(DISTINCT n.message, ' || ') INTO v_txt
  FROM public.notifications n
  JOIN public.students s ON s.user_id = n.recipient_id
  JOIN public.enrollments e ON e.student_id = s.id
  WHERE e.id = 6363 AND n.subject = 'Pago registrado';
  v_rows := v_rows || jsonb_build_object('n', 8,
    'caso', 'N01/N02/N04 avisos "Pago registrado" del alumno de la matrícula 6363 (tiene un "Cobrar después" de $180.000 y los abonos de prueba)',
    'esperado', '¿?', 'obtenido', COALESCE(v_txt, 'ninguno'));

  SELECT count(*) INTO v_n
  FROM public.notifications n
  WHERE n.subject = 'Pago registrado'
    AND n.recipient_id IN (SELECT u.id FROM public.users u JOIN public.roles r ON r.id = u.role_id
                           WHERE r.name IN ('admin', 'secretary'));
  v_rows := v_rows || jsonb_build_object('n', 9, 'caso', 'N03 avisos "Pago registrado" enviados a admin/secretaria',
    'esperado', '0', 'obtenido', v_n::text);

  INSERT INTO rb4 (n, caso, esperado, obtenido)
  SELECT n, caso, esperado, obtenido
  FROM jsonb_to_recordset(v_rows) AS t(n int, caso text, esperado text, obtenido text);
END;
$test$;

SELECT n, caso, esperado, obtenido,
       CASE WHEN esperado = '¿?' THEN 'pregunta'
            WHEN obtenido IS NOT DISTINCT FROM esperado THEN '✅' ELSE '❌' END AS resultado
FROM rb4
ORDER BY n;
