-- ============================================================================
-- Prueba de BD — fix-363-m: auditoría infalsificable y funciones cerradas
-- ============================================================================
-- ACs en specs/fixes/fix-363-m-auditoria-falsificable-y-rpc-abiertas/fix.md (F1–F10).
-- Lo que escribe corre en sub-bloques que SIEMPRE abortan (ZZ001): no deja cambios ni filas en
-- audit_log. Correr como postgres. Resultado en la tabla temporal r363 (último SELECT);
-- "FALLA" = ❌. Datos de prueba: admin@test.com, secretaria@test.com, alumno@test.com, un
-- vehículo y un pago cualquiera.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r363;
CREATE TEMP TABLE r363 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  f record;
  v_admin_uid uuid; v_admin_id int;
  v_sec_uid   uuid; v_sec_id   int;
  v_alu_uid   uuid;
  v_vehicle int; v_payment int; v_course int;
  v_max bigint; v_uid int; v_n int;
  v_ret text; v_err text; v_txt text;
  v_sig text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT supabase_uid, id INTO v_admin_uid, v_admin_id FROM public.users WHERE email = 'admin@test.com';
  SELECT supabase_uid, id INTO v_sec_uid,   v_sec_id   FROM public.users WHERE email = 'secretaria@test.com';
  SELECT supabase_uid       INTO v_alu_uid             FROM public.users WHERE email = 'alumno@test.com';
  SELECT id INTO v_vehicle FROM public.vehicles ORDER BY id LIMIT 1;
  SELECT id INTO v_payment FROM public.payments
   WHERE registered_by IS DISTINCT FROM v_admin_id ORDER BY id DESC LIMIT 1;
  SELECT id INTO v_course FROM public.courses WHERE license_class IS NOT NULL ORDER BY id LIMIT 1;
  IF v_admin_uid IS NULL OR v_sec_uid IS NULL OR v_alu_uid IS NULL
     OR v_vehicle IS NULL OR v_payment IS NULL OR v_course IS NULL THEN
    RAISE EXCEPTION 'Faltan datos de prueba';
  END IF;

  -- ── F1: privilegios y policies de audit_log ───────────────────────────────
  FOR f IN SELECT * FROM (VALUES ('anon', false), ('authenticated', true)) AS t(rol, lee) LOOP
    v_txt := format('SELECT %s · INSERT %s · UPDATE %s · DELETE %s · TRUNCATE %s',
      has_table_privilege(f.rol, 'public.audit_log', 'SELECT'),
      has_table_privilege(f.rol, 'public.audit_log', 'INSERT'),
      has_table_privilege(f.rol, 'public.audit_log', 'UPDATE'),
      has_table_privilege(f.rol, 'public.audit_log', 'DELETE'),
      has_table_privilege(f.rol, 'public.audit_log', 'TRUNCATE'));
    INSERT INTO r363 VALUES ('F1 privilegios de ' || f.rol || ' en audit_log',
      format('SELECT %s · INSERT f · UPDATE f · DELETE f · TRUNCATE f', f.lee), v_txt,
      CASE WHEN v_txt = format('SELECT %s · INSERT f · UPDATE f · DELETE f · TRUNCATE f', f.lee)
           THEN 'ok' ELSE 'FALLA' END);
  END LOOP;

  SELECT string_agg(policyname || ':' || cmd, ', ' ORDER BY policyname) INTO v_txt
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_log';
  INSERT INTO r363 VALUES ('F1 policies de audit_log', 'select_audit_log:SELECT', v_txt,
    CASE WHEN v_txt = 'select_audit_log:SELECT' THEN 'ok' ELSE 'FALLA' END);

  -- F1: intentos reales con sesión (secretaria) y sin sesión.
  FOR f IN SELECT * FROM (VALUES
      ('F1 secretaria inserta una fila falsa', 'authenticated', 'INSERT'),
      ('F1 secretaria modifica filas',         'authenticated', 'UPDATE'),
      ('F1 secretaria borra filas',            'authenticated', 'DELETE'),
      ('F1 sin sesión inserta una fila falsa', 'anon',          'INSERT')
    ) AS t(caso, rol, op)
  LOOP
    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims',
        CASE WHEN f.rol = 'anon' THEN json_build_object('role', 'anon')::text
             ELSE json_build_object('sub', v_sec_uid, 'role', 'authenticated')::text END, true);
      EXECUTE format('SET LOCAL ROLE %I', f.rol);
      BEGIN
        IF f.op = 'INSERT' THEN
          INSERT INTO public.audit_log (user_id, action, entity, detail)
          VALUES (v_admin_id, 'DELETE', 'payments', 'fila fabricada');
        ELSIF f.op = 'UPDATE' THEN
          UPDATE public.audit_log SET detail = 'alterado';
        ELSE
          DELETE FROM public.audit_log;
        END IF;
      EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE || ' ' || SQLERRM; END;
      EXECUTE 'RESET ROLE';
      RAISE SQLSTATE 'ZZ001';
    EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
    EXECUTE 'RESET ROLE';
    INSERT INTO r363 VALUES (f.caso, 'rechazado (42501)', coalesce(v_err, 'se ejecutó'),
      CASE WHEN v_err LIKE '42501%' THEN 'ok' ELSE 'FALLA' END);
  END LOOP;

  -- ── F2 / F3 / F4: a nombre de quién queda un cambio ──────────────────────
  -- quien: 1 = sesión de la secretaria · 2 = service key · 3 = sin sesión (anon) · 0 = sin request
  FOR f IN SELECT * FROM (VALUES
      ('F2 sesión + header ajeno → queda la sesión',            1, true,  'vehicles', 'secretaria'),
      ('F2 sesión + registered_by ajeno → queda la sesión',     1, false, 'payments', 'secretaria'),
      ('F3 service key + header → queda el del header',         2, true,  'vehicles', 'admin'),
      ('F2 sin sesión (anon) + header → el header no vale',     3, true,  'vehicles', 'nadie'),
      ('F4 sin sesión ni header + registered_by → ese usuario', 0, false, 'payments', 'admin'),
      ('F5 sesión sin header → queda la sesión',                1, false, 'vehicles', 'secretaria')
    ) AS t(caso, quien, header, tabla, esperado)
  LOOP
    v_uid := NULL; v_n := 0; v_err := NULL;
    BEGIN
      SELECT coalesce(max(id), 0) INTO v_max FROM public.audit_log;
      PERFORM set_config('request.jwt.claims',
        CASE f.quien
          WHEN 1 THEN json_build_object('sub', v_sec_uid, 'role', 'authenticated')::text
          WHEN 2 THEN json_build_object('role', 'service_role')::text
          WHEN 3 THEN json_build_object('role', 'anon')::text
          ELSE '' END, true);
      PERFORM set_config('request.headers',
        CASE WHEN f.header THEN json_build_object('x-audit-user-id', v_admin_id::text)::text ELSE '' END, true);
      BEGIN
        IF f.tabla = 'vehicles' THEN
          UPDATE public.vehicles SET model = coalesce(model, '') || 'T' WHERE id = v_vehicle;
        ELSE
          UPDATE public.payments SET registered_by = v_admin_id WHERE id = v_payment;
        END IF;
        SELECT count(*), max(user_id) INTO v_n, v_uid FROM public.audit_log
         WHERE id > v_max AND entity = f.tabla;
      EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE || ' ' || SQLERRM; END;
      RAISE SQLSTATE 'ZZ001';
    EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
    v_txt := CASE WHEN v_err IS NOT NULL THEN v_err
                  WHEN v_n = 0 THEN 'no se registró'
                  WHEN v_uid = v_sec_id THEN 'secretaria'
                  WHEN v_uid = v_admin_id THEN 'admin'
                  WHEN v_uid IS NULL THEN 'nadie'
                  ELSE 'usuario ' || v_uid END;
    INSERT INTO r363 VALUES (f.caso, f.esperado, v_txt,
      CASE WHEN v_txt = f.esperado THEN 'ok' ELSE 'FALLA' END);
  END LOOP;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.headers', '', true);

  -- ── F5: el admin sigue leyendo la auditoría ──────────────────────────────
  v_n := NULL; v_err := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_uid, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
      SELECT count(*) INTO v_n FROM (SELECT 1 FROM public.audit_log LIMIT 5) t;
    EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE || ' ' || SQLERRM; END;
    EXECUTE 'RESET ROLE';
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  EXECUTE 'RESET ROLE';
  INSERT INTO r363 VALUES ('F5 el admin lee audit_log', 've filas', coalesce(v_err, v_n || ' fila(s)'),
    CASE WHEN v_n > 0 THEN 'ok' ELSE 'FALLA' END);

  -- ── F6 / F8: privilegios de funciones ────────────────────────────────────
  FOR f IN SELECT * FROM (VALUES
      ('F6', 'get_student_payment_status(text)',   false),
      ('F7', 'get_next_enrollment_number(integer)', true),
      ('F8', 'soft_delete_task(uuid)',              true),
      ('F8', 'user_complete_first_login()',         true)
    ) AS t(ac, sig, auth)
  LOOP
    v_txt := format('anon %s · authenticated %s · service_role %s',
      has_function_privilege('anon', 'public.' || f.sig, 'EXECUTE'),
      has_function_privilege('authenticated', 'public.' || f.sig, 'EXECUTE'),
      has_function_privilege('service_role', 'public.' || f.sig, 'EXECUTE'));
    INSERT INTO r363 VALUES (f.ac || ' privilegios ' || f.sig,
      format('anon f · authenticated %s · service_role t', f.auth), v_txt,
      CASE WHEN v_txt = format('anon f · authenticated %s · service_role t', f.auth)
           THEN 'ok' ELSE 'FALLA' END);
  END LOOP;

  -- ── F7: get_next_enrollment_number según quién llama ─────────────────────
  FOR f IN SELECT * FROM (VALUES
      ('F7 número de matrícula como alumno',     1, 'rechazado'),
      ('F7 número de matrícula como secretaria', 2, 'número'),
      ('F7 número de matrícula sin sesión (dueño / service key)', 0, 'número')
    ) AS t(caso, quien, esperado)
  LOOP
    v_ret := NULL; v_err := NULL;
    BEGIN
      IF f.quien = 0 THEN
        PERFORM set_config('request.jwt.claims', '', true);
      ELSE
        PERFORM set_config('request.jwt.claims', json_build_object(
          'sub', CASE WHEN f.quien = 1 THEN v_alu_uid ELSE v_sec_uid END, 'role', 'authenticated')::text, true);
        EXECUTE 'SET LOCAL ROLE authenticated';
      END IF;
      BEGIN
        v_ret := public.get_next_enrollment_number(v_course);
      EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE || ' ' || SQLERRM; END;
      EXECUTE 'RESET ROLE';
      RAISE SQLSTATE 'ZZ001';
    EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
    EXECUTE 'RESET ROLE';
    INSERT INTO r363 VALUES (f.caso, f.esperado, coalesce('nº ' || v_ret, v_err),
      CASE
        WHEN f.esperado = 'rechazado' AND v_err LIKE '42501%' THEN 'ok'
        WHEN f.esperado = 'número' AND v_ret ~ '^[0-9]+$' THEN 'ok'
        ELSE 'FALLA' END);
  END LOOP;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ── F9: ninguna SECURITY DEFINER sin search_path ─────────────────────────
  SELECT coalesce(string_agg(p.oid::regprocedure::text, ', '), 'ninguna') INTO v_txt
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
     AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%');
  INSERT INTO r363 VALUES ('F9 SECURITY DEFINER sin search_path', 'ninguna', v_txt,
    CASE WHEN v_txt = 'ninguna' THEN 'ok' ELSE 'FALLA' END);

  -- ── F10: una función nueva nace cerrada ──────────────────────────────────
  v_txt := NULL; v_err := NULL;
  BEGIN
    BEGIN
      EXECUTE 'CREATE FUNCTION public._fix363_sonda() RETURNS int LANGUAGE sql AS ''SELECT 1''';
      v_txt := format('anon %s · authenticated %s · service_role %s',
        has_function_privilege('anon', 'public._fix363_sonda()', 'EXECUTE'),
        has_function_privilege('authenticated', 'public._fix363_sonda()', 'EXECUTE'),
        has_function_privilege('service_role', 'public._fix363_sonda()', 'EXECUTE'));
    EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE || ' ' || SQLERRM; END;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r363 VALUES ('F10 función nueva en public', 'anon f · authenticated f · service_role t',
    coalesce(v_txt, v_err),
    CASE WHEN v_txt = 'anon f · authenticated f · service_role t' THEN 'ok' ELSE 'FALLA' END);

  v_txt := NULL; v_err := NULL;
  BEGIN
    BEGIN
      EXECUTE 'CREATE FUNCTION extensions._fix363_sonda() RETURNS int LANGUAGE sql AS ''SELECT 1''';
      v_txt := format('anon %s · authenticated %s',
        has_function_privilege('anon', 'extensions._fix363_sonda()', 'EXECUTE'),
        has_function_privilege('authenticated', 'extensions._fix363_sonda()', 'EXECUTE'));
    EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE || ' ' || SQLERRM; END;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r363 VALUES ('F10 función nueva en extensions sigue disponible', 'anon t · authenticated t',
    coalesce(v_txt, v_err),
    CASE WHEN v_txt = 'anon t · authenticated t' THEN 'ok' ELSE 'FALLA' END);

  -- Nada quedó escrito.
  INSERT INTO r363 VALUES ('Sin efectos: no quedó la función de sonda', 'no existe',
    CASE WHEN to_regprocedure('public._fix363_sonda()') IS NULL THEN 'no existe' ELSE 'existe' END,
    CASE WHEN to_regprocedure('public._fix363_sonda()') IS NULL THEN 'ok' ELSE 'FALLA' END);
END
$test$;

SELECT * FROM r363;
