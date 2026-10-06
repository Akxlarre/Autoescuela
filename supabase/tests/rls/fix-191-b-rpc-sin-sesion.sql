-- ============================================================================
-- Prueba de BD — fix-191-b: funciones que escriben ya no se ejecutan sin sesión
-- ============================================================================
-- ACs en specs/fixes/fix-191-b-rpc-ejecutables-sin-sesion/fix.md (F1–F7).
-- Los intentos de ejecución corren en sub-bloques que SIEMPRE abortan (ZZ001): no dejan cambios.
-- Correr como postgres. Resultado en la tabla temporal r191 (último SELECT); "FALLA" = ❌.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r191;
CREATE TEMP TABLE r191 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  f record;
  v_e1 int; v_e2 int;                -- matrículas activas de la sede 1 y de la sede 2
  v_sec1 uuid; v_admin uuid;
  v_ret text; v_err text; v_st text;
  c_cron CONSTANT text[] := ARRAY[
    'mark_end_of_day_class_b_absences()', 'cleanup_expired_drafts()',
    'cleanup_expired_public_enrollment()', 'cleanup_public_enrollment_throttle()',
    'auto_transition_promotion_status()', 'auto_transition_standalone_course_status()',
    'auto_transition_theory_cycle_status()', 'ensure_theory_cycle(integer, date)',
    'notify_vehicle_document_expiry()', 'recalc_instructor_monthly_hours(integer, text)'];
  c_app CONSTANT text[] := ARRAY[
    'get_next_enrollment_number(integer)',
    'confirm_enrollment_with_payment(integer, text, integer, integer, integer, integer, boolean)',
    'apply_class_b_absence_penalty(integer)'];
  v_sig text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  -- ── F1 / F2 / F5: privilegios ─────────────────────────────────────────────
  FOREACH v_sig IN ARRAY c_cron LOOP
    INSERT INTO r191 VALUES ('privilegios ' || v_sig, 'anon ✗ · authenticated ✗ · service_role ✓',
      format('anon %s · authenticated %s · service_role %s',
        has_function_privilege('anon', 'public.' || v_sig, 'EXECUTE'),
        has_function_privilege('authenticated', 'public.' || v_sig, 'EXECUTE'),
        has_function_privilege('service_role', 'public.' || v_sig, 'EXECUTE')),
      CASE WHEN NOT has_function_privilege('anon', 'public.' || v_sig, 'EXECUTE')
            AND NOT has_function_privilege('authenticated', 'public.' || v_sig, 'EXECUTE')
            AND has_function_privilege('service_role', 'public.' || v_sig, 'EXECUTE') THEN 'ok' ELSE 'FALLA' END);
  END LOOP;
  FOREACH v_sig IN ARRAY c_app LOOP
    INSERT INTO r191 VALUES ('privilegios ' || v_sig, 'anon ✗ · authenticated ✓ · service_role ✓',
      format('anon %s · authenticated %s · service_role %s',
        has_function_privilege('anon', 'public.' || v_sig, 'EXECUTE'),
        has_function_privilege('authenticated', 'public.' || v_sig, 'EXECUTE'),
        has_function_privilege('service_role', 'public.' || v_sig, 'EXECUTE')),
      CASE WHEN NOT has_function_privilege('anon', 'public.' || v_sig, 'EXECUTE')
            AND has_function_privilege('authenticated', 'public.' || v_sig, 'EXECUTE')
            AND has_function_privilege('service_role', 'public.' || v_sig, 'EXECUTE') THEN 'ok' ELSE 'FALLA' END);
  END LOOP;

  -- ── Datos: una matrícula activa por sede, que se vuelve borrador dentro de cada bloque ──
  SELECT id INTO v_e1 FROM public.enrollments WHERE branch_id = 1 AND status = 'active' ORDER BY id LIMIT 1;
  SELECT id INTO v_e2 FROM public.enrollments WHERE branch_id = 2 AND status = 'active' ORDER BY id LIMIT 1;
  SELECT supabase_uid INTO v_sec1  FROM public.users WHERE email = 'secretaria@test.com';
  SELECT supabase_uid INTO v_admin FROM public.users WHERE email = 'admin@test.com';
  IF v_e1 IS NULL OR v_e2 IS NULL OR v_sec1 IS NULL OR v_admin IS NULL THEN
    RAISE EXCEPTION 'Faltan datos de prueba';
  END IF;

  -- Llama confirm como (rol, uid) sobre una matrícula convertida en borrador; devuelve resultado.
  FOR f IN SELECT * FROM (VALUES
      ('F1 confirm como anon (sin sesión)',            'anon',          NULL::uuid, 0, 'rechazado'),
      ('F3 confirm secretaria sede 1 → matrícula sede 2', 'authenticated', NULL::uuid, 2, 'rechazado'),
      ('F7 confirm secretaria sede 1 → matrícula sede 1', 'authenticated', NULL::uuid, 1, 'confirmada'),
      ('F3 confirm admin → matrícula sede 2',          'authenticated', NULL::uuid, 3, 'confirmada')
    ) AS t(caso, rol, uid, quien, esperado)
  LOOP
    v_ret := NULL; v_err := NULL; v_st := NULL;
    BEGIN
      UPDATE public.enrollments SET status = 'draft', pending_balance = base_price, total_paid = 0, number = NULL
       WHERE id = CASE WHEN f.quien IN (2, 3) THEN v_e2 ELSE v_e1 END;
      PERFORM set_config('request.jwt.claims',
        CASE f.quien
          WHEN 0 THEN json_build_object('role', 'anon')::text
          WHEN 3 THEN json_build_object('sub', v_admin, 'role', 'authenticated')::text
          ELSE json_build_object('sub', v_sec1, 'role', 'authenticated')::text END, true);
      EXECUTE format('SET LOCAL ROLE %I', f.rol);
      BEGIN
        v_ret := public.confirm_enrollment_with_payment(
          CASE WHEN f.quien IN (2, 3) THEN v_e2 ELSE v_e1 END, 'efectivo', 1, NULL, 0, NULL, false);
      EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE || ' ' || SQLERRM; END;
      EXECUTE 'RESET ROLE';
      SELECT status INTO v_st FROM public.enrollments WHERE id = CASE WHEN f.quien IN (2, 3) THEN v_e2 ELSE v_e1 END;
      RAISE SQLSTATE 'ZZ001';
    EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
    EXECUTE 'RESET ROLE';
    INSERT INTO r191 VALUES (f.caso, f.esperado,
      coalesce('nº ' || v_ret || ' / ' || v_st, v_err),
      CASE
        WHEN f.esperado = 'rechazado'  AND v_ret IS NULL AND v_err LIKE '42501%' THEN 'ok'
        WHEN f.esperado = 'confirmada' AND v_ret IS NOT NULL AND v_st = 'active'  THEN 'ok'
        ELSE 'FALLA' END);
  END LOOP;

  -- ── F4: penalización ─────────────────────────────────────────────────────
  FOR f IN SELECT * FROM (VALUES
      ('F4 penalización secretaria sede 1 → matrícula sede 2', 1, 2, 'rechazado'),
      ('F4 penalización secretaria sede 1 → matrícula sede 1', 1, 1, '-1'),
      ('F4 penalización desde el cron (sin sesión, dueño)',    0, 2, '-1')
    ) AS t(caso, quien, sede, esperado)
  LOOP
    v_ret := NULL; v_err := NULL;
    BEGIN
      IF f.quien = 1 THEN
        PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec1, 'role', 'authenticated')::text, true);
        EXECUTE 'SET LOCAL ROLE authenticated';
      ELSE
        PERFORM set_config('request.jwt.claims', '', true);
      END IF;
      BEGIN
        v_ret := public.apply_class_b_absence_penalty(CASE WHEN f.sede = 2 THEN v_e2 ELSE v_e1 END)::text;
      EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE || ' ' || SQLERRM; END;
      EXECUTE 'RESET ROLE';
      RAISE SQLSTATE 'ZZ001';
    EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
    EXECUTE 'RESET ROLE';
    INSERT INTO r191 VALUES (f.caso, f.esperado, coalesce(v_ret, v_err),
      CASE
        WHEN f.esperado = 'rechazado' AND v_err LIKE '42501%' THEN 'ok'
        WHEN v_ret = f.esperado THEN 'ok'
        ELSE 'FALLA' END);
  END LOOP;

  -- ── F2: el cron sigue pudiendo correr (como dueño, sin sesión) ───────────
  v_err := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims', '', true);
    BEGIN
      PERFORM public.cleanup_expired_drafts();
      PERFORM public.auto_transition_theory_cycle_status();
    EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE || ' ' || SQLERRM; END;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r191 VALUES ('F2 funciones de cron como dueño', 'corren', coalesce(v_err, 'corren'),
    CASE WHEN v_err IS NULL THEN 'ok' ELSE 'FALLA' END);

  -- ── F6: search_path fijo ──────────────────────────────────────────────────
  SELECT coalesce(array_to_string(proconfig, ','), 'sin search_path') INTO v_st
    FROM pg_proc WHERE oid = 'public.confirm_enrollment_with_payment(integer, text, integer, integer, integer, integer, boolean)'::regprocedure;
  INSERT INTO r191 VALUES ('F6 search_path de confirm', 'search_path=""', v_st,
    CASE WHEN v_st LIKE 'search_path=%' THEN 'ok' ELSE 'FALLA' END);
END
$test$;

SELECT * FROM r191;
