-- ============================================================================
-- fix-069-i — borrador con pago: descarte por la secretaria, limpieza nocturna y auditoría.
-- Arma borradores de prueba en la sede 1 (con pago, con pago en un día de caja cerrada, sin nada,
-- vencido con pago vivo y vencido con pago anulado), impersona a las secretarias de prueba y
-- revisa AC-F1, AC-F2, AC-F3 y AC-F6.
-- Todo corre en un sub-bloque que SIEMPRE aborta (ZZ001): no deja cambios. Correr como postgres.
-- Requiere la migración 20261024120000 aplicada.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r069;
CREATE TEMP TABLE r069 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_res      text[] := '{}';   -- 'caso|esperado|obtenido' (las variables sobreviven al aborto)
  v_stu      int[];
  v_course   int[];
  v_sec1     int;
  v_sec1_uid uuid;
  v_sec2_uid uuid;
  v_admin_uid uuid;
  v_activa   int;
  v_cerrada  date;
  d_pago int; d_cerrada int; d_vacio int; d_venc_vivo int; d_venc_anulado int;
  p_pago int; p_cerrada int; p_venc_vivo int; p_venc_anulado int;
  v_out      text;
  v_rows     bigint;
  v_txt      text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT id, supabase_uid INTO v_sec1, v_sec1_uid FROM public.users WHERE email = 'secretaria@test.com';
  SELECT supabase_uid INTO v_sec2_uid FROM public.users WHERE email = 'secretaria2@test.com';
  SELECT supabase_uid INTO v_admin_uid FROM public.users WHERE email = 'admin@test.com';
  IF v_sec1_uid IS NULL OR v_sec2_uid IS NULL OR v_admin_uid IS NULL THEN
    RAISE EXCEPTION 'Faltan los usuarios de prueba (secretaria, secretaria2, admin @test.com)';
  END IF;

  -- 5 alumnos distintos con matrícula activa en la sede 1 (a cada uno se le arma un borrador)
  SELECT array_agg(student_id), array_agg(course_id) INTO v_stu, v_course
  FROM (
    SELECT DISTINCT ON (e.student_id) e.student_id, e.course_id
    FROM public.enrollments e
    WHERE e.status = 'active' AND e.branch_id = 1
    ORDER BY e.student_id, e.id DESC
    LIMIT 5
  ) x;
  IF coalesce(array_length(v_stu, 1), 0) < 5 THEN
    RAISE EXCEPTION 'Faltan 5 alumnos con matrícula activa en la sede 1';
  END IF;

  SELECT id INTO v_activa FROM public.enrollments WHERE status = 'active' AND branch_id = 1
  ORDER BY id DESC LIMIT 1;

  SELECT c.date INTO v_cerrada FROM public.cash_closings c
  WHERE c.branch_id = 1 AND c.status = 'closed' ORDER BY c.date DESC LIMIT 1;

  IF EXISTS (SELECT 1 FROM public.cash_closings c
             WHERE c.branch_id = 1 AND c.date = DATE '2020-01-02' AND c.status = 'closed') THEN
    RAISE EXCEPTION 'El 2020-01-02 tiene caja cerrada en la sede 1: elegir otra fecha de prueba';
  END IF;

  BEGIN
    -- ── Preparación (como postgres, sin sesión) ──────────────────────────────
    INSERT INTO public.enrollments (student_id, course_id, branch_id, base_price, discount, total_paid,
      pending_balance, status, expires_at, docs_complete, contract_accepted, certificate_enabled,
      registration_channel)
    SELECT v_stu[i], v_course[i], 1, 100000, 0, 0, NULL, 'draft',
           CASE WHEN i >= 4 THEN NOW() - interval '1 hour' ELSE NOW() + interval '10 hours' END,
           false, false, false, 'in_person'
    FROM generate_series(1, 5) AS i
    ORDER BY i;

    SELECT id INTO d_pago        FROM public.enrollments WHERE status = 'draft' AND student_id = v_stu[1] ORDER BY id DESC LIMIT 1;
    SELECT id INTO d_cerrada     FROM public.enrollments WHERE status = 'draft' AND student_id = v_stu[2] ORDER BY id DESC LIMIT 1;
    SELECT id INTO d_vacio       FROM public.enrollments WHERE status = 'draft' AND student_id = v_stu[3] ORDER BY id DESC LIMIT 1;
    SELECT id INTO d_venc_vivo   FROM public.enrollments WHERE status = 'draft' AND student_id = v_stu[4] ORDER BY id DESC LIMIT 1;
    SELECT id INTO d_venc_anulado FROM public.enrollments WHERE status = 'draft' AND student_id = v_stu[5] ORDER BY id DESC LIMIT 1;

    INSERT INTO public.payments (enrollment_id, type, total_amount, cash_amount, status, payment_date)
    VALUES (d_pago, 'enrollment', 1000, 1000, 'paid', DATE '2020-01-02') RETURNING id INTO p_pago;
    INSERT INTO public.payments (enrollment_id, type, total_amount, cash_amount, status, payment_date)
    VALUES (d_venc_vivo, 'enrollment', 1000, 1000, 'paid', DATE '2020-01-02') RETURNING id INTO p_venc_vivo;
    INSERT INTO public.payments (enrollment_id, type, total_amount, cash_amount, status, payment_date)
    VALUES (d_venc_anulado, 'enrollment', 1000, 1000, 'paid', DATE '2020-01-02') RETURNING id INTO p_venc_anulado;
    IF v_cerrada IS NOT NULL THEN
      INSERT INTO public.payments (enrollment_id, type, total_amount, cash_amount, status, payment_date)
      VALUES (d_cerrada, 'enrollment', 1000, 1000, 'paid', v_cerrada) RETURNING id INTO p_cerrada;
    END IF;

    -- ── AC-F3: la secretaria de la otra sede no puede ───────────────────────
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_sec2_uid, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
      PERFORM public.descartar_borrador_con_historial(d_pago, 'test-069');
      v_out := 'pudo';
    EXCEPTION WHEN OTHERS THEN v_out := 'rechazado';
    END;
    v_res := v_res || format('AC-F3 secretaria de la sede 2 descarta un borrador de la sede 1|rechazado|%s', v_out);
    EXECUTE 'RESET ROLE';

    -- ── Secretaria de la sede 1 ───────────────────────────────────────────────
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_sec1_uid, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';

    -- AC-F2 sin motivo: no cambia nada
    BEGIN
      PERFORM public.descartar_borrador_con_historial(d_pago, '   ');
      v_out := 'pudo';
    EXCEPTION WHEN OTHERS THEN v_out := SQLERRM;
    END;
    v_res := v_res || format('AC-F2 sin motivo → error|ANULAR_SIN_MOTIVO|%s', v_out);

    -- AC-F3 la secretaria no anula directo (sin la RPC): la RLS no le da UPDATE
    UPDATE public.payments SET status = 'anulado', void_reason = 'directo' WHERE id = p_pago;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_res := v_res || format('AC-F3 UPDATE directo de la secretaria → 0 filas|0|%s', v_rows);

    -- AC-F2 con motivo
    BEGIN
      v_out := public.descartar_borrador_con_historial(d_pago, '  test-069 se arrepintió  ')::text;
    EXCEPTION WHEN OTHERS THEN v_out := 'error: ' || SQLERRM;
    END;
    v_res := v_res || format('AC-F2 con motivo → true|true|%s', v_out);

    -- AC-F2 caja cerrada: no cambia nada
    IF v_cerrada IS NOT NULL THEN
      BEGIN
        PERFORM public.descartar_borrador_con_historial(d_cerrada, 'test-069');
        v_out := 'pudo';
      EXCEPTION WHEN OTHERS THEN v_out := SQLERRM;
      END;
      v_res := v_res || format('AC-F2 pago de un día con caja cerrada → error|CAJA_CERRADA|%s', v_out);
    ELSE
      v_res := v_res || 'AC-F2 caja cerrada (no hay cierres en la sede 1: no se prueba)|informativo|informativo';
    END IF;

    -- AC-F4 sin pagos ni consentimientos → false (la app lo borra como siempre)
    BEGIN
      v_out := public.descartar_borrador_con_historial(d_vacio, NULL)::text;
    EXCEPTION WHEN OTHERS THEN v_out := 'error: ' || SQLERRM;
    END;
    v_res := v_res || format('AC-F4 borrador sin pagos → false|false|%s', v_out);

    -- Una matrícula activa no se descarta por este camino
    BEGIN
      PERFORM public.descartar_borrador_con_historial(v_activa, 'test-069');
      v_out := 'pudo';
    EXCEPTION WHEN OTHERS THEN v_out := 'rechazado';
    END;
    v_res := v_res || format('Matrícula activa → rechazado|rechazado|%s', v_out);

    EXECUTE 'RESET ROLE';

    -- ── Resultado del descarte (como postgres) ─────────────────────────────────
    SELECT status INTO v_txt FROM public.enrollments WHERE id = d_pago;
    v_res := v_res || format('AC-F2 el borrador queda cancelado|cancelled|%s', coalesce(v_txt, 'borrado'));
    SELECT status || ' / ' || coalesce(void_reason, '-') || ' / ' || coalesce((voided_by = v_sec1)::text, '-')
      INTO v_txt FROM public.payments WHERE id = p_pago;
    v_res := v_res || format('AC-F2 el pago queda anulado, con motivo y a nombre de la secretaria|anulado / test-069 se arrepintió / true|%s',
                             coalesce(v_txt, 'borrado'));
    SELECT status INTO v_txt FROM public.enrollments WHERE id = d_cerrada;
    v_res := v_res || format('AC-F2 caja cerrada: el borrador sigue en borrador|draft|%s', coalesce(v_txt, 'borrado'));
    v_res := v_res || format('AC-F4 el borrador sin pagos sigue ahí|draft|%s',
                             coalesce((SELECT status FROM public.enrollments WHERE id = d_vacio), 'borrado'));

    -- AC-F6 la anulación en la auditoría
    SELECT a.detail INTO v_txt FROM public.audit_log a
    WHERE a.entity = 'payments' AND a.entity_id = p_pago AND a.action = 'UPDATE' AND a.user_id = v_sec1
    ORDER BY a.id DESC LIMIT 1;
    v_res := v_res || format('AC-F6 auditoría: "Pago anulado … Motivo … Anulado por" a nombre de la secretaria|sí|%s',
      CASE WHEN v_txt LIKE 'Pago anulado: %— Motivo: test-069 se arrepintió — Anulado por: %' THEN 'sí'
           ELSE coalesce(v_txt, 'sin fila') END);

    -- ── AC-F1 limpieza nocturna ─────────────────────────────────────────────────
    -- El admin anula el pago del vencido "anulado" (fecha 2020-01-02, sin cierre)
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_admin_uid, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.payments SET status = 'anulado', void_reason = 'test-069 admin' WHERE id = p_venc_anulado;
    EXECUTE 'RESET ROLE';

    -- La limpieza corre sin sesión (como pg_cron)
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM public.cleanup_expired_drafts();

    v_res := v_res || format('AC-F1 vencido con pago vivo → no se toca|draft / paid|%s',
      coalesce((SELECT e.status || ' / ' || p.status FROM public.enrollments e
                JOIN public.payments p ON p.enrollment_id = e.id WHERE p.id = p_venc_vivo), 'borrado'));
    v_res := v_res || format('AC-F1 vencido con pagos anulados → cancelado y conserva el pago|cancelled / anulado|%s',
      coalesce((SELECT e.status || ' / ' || p.status FROM public.enrollments e
                JOIN public.payments p ON p.enrollment_id = e.id WHERE p.id = p_venc_anulado), 'borrado'));

    -- AC-F6 lo que hace la limpieza queda sin usuario (Sistema)
    SELECT coalesce(a.user_id::text, 'Sistema') INTO v_txt FROM public.audit_log a
    WHERE a.entity = 'enrollments' AND a.entity_id = d_venc_anulado AND a.action = 'UPDATE'
    ORDER BY a.id DESC LIMIT 1;
    v_res := v_res || format('AC-F6 auditoría de la limpieza → Sistema|Sistema|%s', coalesce(v_txt, 'sin fila'));

    RAISE SQLSTATE 'ZZ001';   -- deshace todo lo anterior
  EXCEPTION
    WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  INSERT INTO r069
  SELECT split_part(r, '|', 1), split_part(r, '|', 2), split_part(r, '|', 3),
         CASE WHEN split_part(r, '|', 2) = split_part(r, '|', 3) THEN 'ok' ELSE 'FALLA' END
    FROM unnest(v_res) AS r;
END
$test$;

SELECT * FROM r069;
