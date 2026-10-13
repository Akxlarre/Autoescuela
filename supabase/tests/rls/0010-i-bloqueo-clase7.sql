-- ============================================================================
-- Prueba de BD — spec 0010-i: la clase 7+ no se inicia sin el segundo pago
-- ============================================================================
-- ACs en specs/specs/0010-i-clase-7-bloqueada-sin-segundo-pago/spec.md.
-- Migración: 20261013120000_spec0010i_bloqueo_clase7_pago_pendiente.sql.
-- Todo lo que escribe corre en sub-bloques que SIEMPRE abortan (ZZ001): no deja clases cambiadas,
-- saldos tocados, habilitaciones ni notificaciones. Los resultados se acumulan en v_rows y se
-- escriben en r0010 al final (una fila escrita dentro de un sub-bloque que aborta se desharía).
-- Correr como postgres en el SQL Editor. Resultado: último SELECT; "❌" = falla.
-- Datos necesarios: una clase Clase B con class_number >= 7, otra con class_number <= 6, un admin
-- activo y secretarias activas (de la misma sede y de otra) con supabase_uid.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r0010;
CREATE TEMP TABLE r0010 (n int, caso text, esperado text, obtenido text);

DO $test$
DECLARE
  v_rows      jsonb := '[]'::jsonb;
  v_s7        int;  -- clase 7+
  v_e7        int;
  v_branch    int;
  v_s6        int;  -- clase 1–6
  v_e6        int;
  v_admin     int;
  v_sec_same  uuid;
  v_sec_other uuid;
  v_n0        int;
  v_n1        int;
  v_bal       int;
  v_err       text;
  v_txt       text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT s.id, s.enrollment_id, e.branch_id INTO v_s7, v_e7, v_branch
  FROM public.class_b_sessions s JOIN public.enrollments e ON e.id = s.enrollment_id
  WHERE s.class_number >= 7 AND e.branch_id IS NOT NULL
  -- Una clase que ya pasó: marcarla no_show con hora futura lo rechaza fix-371
  -- (prevent_early_class_b_no_show).
  ORDER BY (s.scheduled_at <= now()) DESC, s.id DESC LIMIT 1;

  SELECT s.id, s.enrollment_id INTO v_s6, v_e6
  FROM public.class_b_sessions s
  WHERE s.class_number BETWEEN 1 AND 6 AND s.enrollment_id IS NOT NULL AND s.enrollment_id <> v_e7
  ORDER BY s.id DESC LIMIT 1;

  SELECT u.id INTO v_admin FROM public.users u JOIN public.roles r ON r.id = u.role_id
  WHERE r.name = 'admin' AND u.active = true ORDER BY u.id LIMIT 1;

  SELECT u.supabase_uid INTO v_sec_same FROM public.users u JOIN public.roles r ON r.id = u.role_id
  WHERE r.name = 'secretary' AND u.active = true AND u.branch_id = v_branch
    AND u.supabase_uid IS NOT NULL ORDER BY u.id LIMIT 1;

  SELECT u.supabase_uid INTO v_sec_other FROM public.users u JOIN public.roles r ON r.id = u.role_id
  WHERE r.name = 'secretary' AND u.active = true AND u.branch_id IS DISTINCT FROM v_branch
    AND u.supabase_uid IS NOT NULL ORDER BY u.id LIMIT 1;

  IF v_s7 IS NULL OR v_s6 IS NULL OR v_admin IS NULL THEN
    RAISE EXCEPTION 'Faltan datos de prueba (clase 7+, clase 1–6 o admin activo)';
  END IF;

  -- ── 1. Objetos instalados ─────────────────────────────────────────────────
  SELECT string_agg(tgname, ', ' ORDER BY tgname) INTO v_txt
  FROM pg_trigger
  WHERE NOT tgisinternal AND tgname IN (
    'trg_block_class_b_without_second_payment', 'trg_notify_class_b_started_with_debt',
    'trg_notify_payment_override', 'trg_set_payment_override_pending',
    'trg_audit_enrollment_payment_overrides');
  v_rows := v_rows || jsonb_build_object('n', 1, 'caso', 'Triggers instalados',
    'esperado', 'trg_audit_enrollment_payment_overrides, trg_block_class_b_without_second_payment, trg_notify_class_b_started_with_debt, trg_notify_payment_override, trg_set_payment_override_pending',
    'obtenido', v_txt);

  -- ── AC1: clase 7+ con deuda y sin habilitación → bloqueada ───────────────
  BEGIN
    UPDATE public.class_b_sessions SET status = 'scheduled' WHERE id = v_s7;
    UPDATE public.enrollments SET pending_balance = 50000 WHERE id = v_e7;
    DELETE FROM public.enrollment_payment_overrides WHERE enrollment_id = v_e7;

    v_err := 'sin error';
    BEGIN
      UPDATE public.class_b_sessions SET status = 'completed' WHERE id = v_s7;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 2, 'caso', 'AC1 clase 7+ con deuda: scheduled → completed',
      'esperado', 'PAGO_PENDIENTE_CLASE_7', 'obtenido', v_err);

    -- Hueco cerrado: entrar a iniciada desde no_show también se bloquea.
    v_err := 'sin error';
    BEGIN
      UPDATE public.class_b_sessions SET status = 'no_show' WHERE id = v_s7;
    EXCEPTION WHEN OTHERS THEN v_err := 'no se pudo preparar no_show: ' || SQLERRM;
    END;
    IF v_err = 'sin error' THEN
      BEGIN
        UPDATE public.class_b_sessions SET status = 'completed' WHERE id = v_s7;
      EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
      END;
    END IF;
    v_rows := v_rows || jsonb_build_object('n', 3, 'caso', 'AC1 clase 7+ con deuda: no_show → completed',
      'esperado', 'PAGO_PENDIENTE_CLASE_7', 'obtenido', v_err);
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  -- ── AC2: clase 1–6 con deuda → libre ──────────────────────────────────────
  BEGIN
    UPDATE public.class_b_sessions SET status = 'scheduled' WHERE id = v_s6;
    UPDATE public.enrollments SET pending_balance = 50000 WHERE id = v_e6;
    v_err := 'sin error';
    BEGIN
      UPDATE public.class_b_sessions SET status = 'completed' WHERE id = v_s6;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 4, 'caso', 'AC2 clase 1–6 con deuda se completa',
      'esperado', 'sin error', 'obtenido', v_err);
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  -- ── AC4 (control): sin deuda la clase 7+ se completa ──────────────────────
  BEGIN
    UPDATE public.class_b_sessions SET status = 'scheduled' WHERE id = v_s7;
    UPDATE public.enrollments SET pending_balance = 0 WHERE id = v_e7;
    v_err := 'sin error';
    BEGIN
      UPDATE public.class_b_sessions SET status = 'completed' WHERE id = v_s7;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 5, 'caso', 'AC4 clase 7+ sin deuda se completa',
      'esperado', 'sin error', 'obtenido', v_err);
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  -- ── AC-E3: finalizar una clase ya iniciada no se bloquea ──────────────────
  BEGIN
    UPDATE public.enrollments SET pending_balance = 0 WHERE id = v_e7;
    UPDATE public.class_b_sessions SET status = 'scheduled' WHERE id = v_s7;
    v_err := 'sin error';
    BEGIN
      -- Iniciar puede chocar con otra clase en curso del instructor (trigger de spec 0001-i): el
      -- error se reporta en la fila en vez de cortar toda la prueba.
      UPDATE public.class_b_sessions SET status = 'in_progress' WHERE id = v_s7;
      UPDATE public.enrollments SET pending_balance = 50000 WHERE id = v_e7;
      UPDATE public.class_b_sessions SET status = 'completed' WHERE id = v_s7;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 6, 'caso', 'AC-E3 in_progress → completed con deuda',
      'esperado', 'sin error', 'obtenido', v_err);
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  -- ── AC-E2: un pago 'pending' no baja el saldo ─────────────────────────────
  -- trg_update_balance recalcula el saldo desde cero (base − descuento − pagos 'paid') en cada
  -- pago: un saldo puesto a mano se pisa. Se compara contra el saldo real calculado antes.
  -- Usa una matrícula con deuda real (en una pagada completa el chequeo de sobrepago podría
  -- rechazar el pago y no se probaría nada).
  BEGIN
    SELECT e.id, e.base_price - e.discount - COALESCE((
             SELECT SUM(p.total_amount) FROM public.payments p
             WHERE p.enrollment_id = e.id AND p.status = 'paid'), 0)
    INTO v_e6, v_n0
    FROM public.enrollments e
    WHERE e.status <> 'draft' AND e.pending_balance >= 1000
    ORDER BY e.id DESC LIMIT 1;
    v_err := NULL;
    BEGIN
      INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status)
      VALUES (v_e6, 1000, 1000, 'pending');
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    SELECT pending_balance INTO v_bal FROM public.enrollments WHERE id = v_e6;
    v_rows := v_rows || jsonb_build_object('n', 7,
      'caso', 'AC-E2 pago pending no baja el saldo (saldo = base − descuento − pagos paid)',
      'esperado', v_n0::text, 'obtenido', COALESCE(v_err, v_bal::text));
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  -- ── AC5: habilitar sin pago → registro, aviso a admins y la clase pasa ────
  BEGIN
    UPDATE public.class_b_sessions SET status = 'scheduled' WHERE id = v_s7;
    UPDATE public.enrollments SET pending_balance = 50000 WHERE id = v_e7;
    SELECT count(*) INTO v_n0 FROM public.notifications WHERE subject = 'Clases habilitadas sin pago';

    -- El cliente manda pending_at_override = 1: la BD debe guardar el saldo real.
    INSERT INTO public.enrollment_payment_overrides
      (enrollment_id, kind, reason, pending_at_override, created_by)
    VALUES (v_e7, 'clases', 'Prueba 0010-i', 1, v_admin);

    SELECT pending_at_override INTO v_bal FROM public.enrollment_payment_overrides
    WHERE enrollment_id = v_e7 ORDER BY id DESC LIMIT 1;
    v_rows := v_rows || jsonb_build_object('n', 8, 'caso', 'AC5 la constancia guarda el saldo real',
      'esperado', '50000', 'obtenido', v_bal::text);

    SELECT count(*) INTO v_n1 FROM public.notifications WHERE subject = 'Clases habilitadas sin pago';
    SELECT count(*) INTO v_bal FROM public.users u JOIN public.roles r ON r.id = u.role_id
    WHERE r.name = 'admin' AND u.active = true;
    v_rows := v_rows || jsonb_build_object('n', 9, 'caso', 'AC5 un aviso por admin activo',
      'esperado', v_bal::text, 'obtenido', (v_n1 - v_n0)::text);

    v_err := 'sin error';
    BEGIN
      UPDATE public.class_b_sessions SET status = 'completed' WHERE id = v_s7;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 10, 'caso', 'AC5 clase 7+ habilitada se completa',
      'esperado', 'sin error', 'obtenido', v_err);

    v_err := 'sin error';
    BEGIN
      INSERT INTO public.enrollment_payment_overrides (enrollment_id, kind, reason, created_by)
      VALUES (v_e7, 'clases', 'ab', v_admin);
    EXCEPTION WHEN OTHERS THEN v_err := 'rechazado';
    END;
    v_rows := v_rows || jsonb_build_object('n', 11, 'caso', 'AC5 motivo de menos de 5 letras',
      'esperado', 'rechazado', 'obtenido', v_err);
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  -- ── AC10: iniciar una clase habilitada con deuda avisa a secretarias ──────
  BEGIN
    UPDATE public.class_b_sessions SET status = 'scheduled' WHERE id = v_s7;
    UPDATE public.enrollments SET pending_balance = 50000 WHERE id = v_e7;
    INSERT INTO public.enrollment_payment_overrides (enrollment_id, kind, reason, created_by)
    VALUES (v_e7, 'clases', 'Prueba 0010-i', v_admin);
    SELECT count(*) INTO v_n0 FROM public.notifications WHERE subject = 'Clase sin pago';

    v_err := NULL;
    BEGIN
      UPDATE public.class_b_sessions SET status = 'in_progress' WHERE id = v_s7;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    SELECT count(*) INTO v_n1 FROM public.notifications WHERE subject = 'Clase sin pago';
    SELECT count(*) INTO v_bal FROM public.users u JOIN public.roles r ON r.id = u.role_id
    WHERE r.name = 'secretary' AND u.active = true AND u.branch_id = v_branch;
    v_rows := v_rows || jsonb_build_object('n', 12, 'caso', 'AC10 un aviso por secretaria de la sede',
      'esperado', v_bal::text,
      'obtenido', COALESCE('error: ' || v_err, (v_n1 - v_n0)::text));
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  -- ── AC-E4: RLS — secretaria de otra sede no puede habilitar ───────────────
  v_err := 'sin secretaria de otra sede';
  IF v_sec_other IS NOT NULL THEN
    BEGIN
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_sec_other, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      v_err := 'sin error';
      BEGIN
        INSERT INTO public.enrollment_payment_overrides (enrollment_id, kind, reason, created_by)
        VALUES (v_e7, 'clases', 'Prueba 0010-i', public.auth_user_id());
      EXCEPTION WHEN OTHERS THEN v_err := 'rechazado';
      END;
      -- Si la secretaria puede ver ambas sedes, la policy la deja pasar (esperado en ese caso).
      IF v_err = 'sin error' AND (SELECT public.auth_can_access_both_branches()) THEN
        v_err := 'rechazado';
      END IF;
      EXECUTE 'RESET ROLE';
      RAISE EXCEPTION USING ERRCODE = 'ZZ001';
    EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
    END;
    EXECUTE 'RESET ROLE';
  END IF;
  v_rows := v_rows || jsonb_build_object('n', 13, 'caso', 'AC-E4 secretaria de otra sede habilita',
    'esperado', 'rechazado', 'obtenido', v_err);

  -- ── AC-E4 (control): secretaria de la sede sí puede ───────────────────────
  v_err := 'sin secretaria de la sede';
  IF v_sec_same IS NOT NULL THEN
    BEGIN
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_sec_same, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      v_err := 'sin error';
      BEGIN
        INSERT INTO public.enrollment_payment_overrides (enrollment_id, kind, reason, created_by)
        VALUES (v_e7, 'clases', 'Prueba 0010-i', public.auth_user_id());
      EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
      END;
      EXECUTE 'RESET ROLE';
      RAISE EXCEPTION USING ERRCODE = 'ZZ001';
    EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
    END;
    EXECUTE 'RESET ROLE';
  END IF;
  v_rows := v_rows || jsonb_build_object('n', 14, 'caso', 'AC-E4 control: secretaria de la sede habilita',
    'esperado', 'sin error', 'obtenido', v_err);

  -- ── Solo inserción: ni la secretaria de la sede puede borrar una habilitación ─
  v_err := 'sin secretaria de la sede';
  IF v_sec_same IS NOT NULL THEN
    BEGIN
      INSERT INTO public.enrollment_payment_overrides (enrollment_id, kind, reason, created_by)
      VALUES (v_e7, 'clases', 'Prueba 0010-i', v_admin);
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_sec_same, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      v_err := 'borró';
      BEGIN
        DELETE FROM public.enrollment_payment_overrides WHERE enrollment_id = v_e7;
        IF NOT FOUND THEN v_err := 'no borra'; END IF;
      EXCEPTION WHEN OTHERS THEN v_err := 'no borra';
      END;
      EXECUTE 'RESET ROLE';
      RAISE EXCEPTION USING ERRCODE = 'ZZ001';
    EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
    END;
    EXECUTE 'RESET ROLE';
  END IF;
  v_rows := v_rows || jsonb_build_object('n', 15, 'caso', 'Solo inserción: secretaria intenta borrar',
    'esperado', 'no borra', 'obtenido', v_err);

  INSERT INTO r0010 (n, caso, esperado, obtenido)
  SELECT n, caso, esperado, obtenido
  FROM jsonb_to_recordset(v_rows) AS t(n int, caso text, esperado text, obtenido text);
END;
$test$;

SELECT n, caso, esperado, obtenido,
       CASE WHEN obtenido IS NOT DISTINCT FROM esperado THEN '✅' ELSE '❌' END AS resultado
FROM r0010
ORDER BY n;
