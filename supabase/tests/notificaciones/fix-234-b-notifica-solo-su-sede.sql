-- ============================================================================
-- Test — fix-234-b: una secretaria solo crea notificaciones para usuarios de su sede
-- ============================================================================
-- Impersona secretarias reales en sub-bloques que siempre abortan (SQLSTATE ZZ001): las
-- notificaciones creadas y el cambio de both_branches se deshacen. Correr como postgres.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r234;
CREATE TEMP TABLE r234 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_res        text[] := '{}';
  v_caso       record;
  v_err        text;
  v_uid        uuid;
  v_admin      int;
  v_sec_b      int;
  v_alumno_a   int;
  v_alumno_b   int;
  v_instr_b    int;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT id INTO v_admin FROM public.users WHERE email = 'admin@test.com';
  SELECT id INTO v_sec_b FROM public.users WHERE email = 'secretaria2@test.com';
  SELECT u.id INTO v_alumno_a FROM public.users u JOIN public.roles r ON r.id = u.role_id
   WHERE r.name = 'student' AND u.active AND u.branch_id = 1 ORDER BY u.id LIMIT 1;
  SELECT u.id INTO v_alumno_b FROM public.users u JOIN public.roles r ON r.id = u.role_id
   WHERE r.name = 'student' AND u.active AND u.branch_id = 2 ORDER BY u.id LIMIT 1;
  SELECT u.id INTO v_instr_b FROM public.instructors i JOIN public.users u ON u.id = i.user_id
   WHERE u.active AND u.branch_id = 2 ORDER BY u.id LIMIT 1;
  IF v_admin IS NULL OR v_sec_b IS NULL OR v_alumno_a IS NULL OR v_alumno_b IS NULL OR v_instr_b IS NULL THEN
    RAISE EXCEPTION 'Faltan cuentas o usuarios de prueba';
  END IF;

  FOR v_caso IN
    SELECT * FROM (VALUES
      ('secretaria@test.com', 'alumno de su sede',              v_alumno_a, false, 'ok'),
      ('secretaria@test.com', 'admin (sin sede)',               v_admin,    false, 'ok'),
      ('secretaria@test.com', 'secretaria de la otra sede',     v_sec_b,    false, '42501'),
      ('secretaria@test.com', 'alumno de la otra sede',         v_alumno_b, false, '42501'),
      ('secretaria@test.com', 'instructor "ambas sedes" de la otra sede', v_instr_b, true, 'ok'),
      ('secretaria@test.com', 'instructor de la otra sede',     v_instr_b,  false, '42501'),
      ('secretaria.multisede@test.com', 'multisede → alumno de la otra sede', v_alumno_b, false, 'ok'),
      ('admin@test.com',      'admin → alumno de cualquier sede', v_alumno_b, false, 'ok')
    ) AS t(quien, caso, destinatario, ambas, esperado)
  LOOP
    SELECT supabase_uid INTO v_uid FROM public.users WHERE email = v_caso.quien;
    v_err := 'ok';
    BEGIN
      UPDATE public.instructors SET both_branches = v_caso.ambas WHERE user_id = v_instr_b;
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      INSERT INTO public.notifications (recipient_id, type, subject, message, read, sent_ok)
      VALUES (v_caso.destinatario, 'system', 'E2E-fix234', 'prueba', false, true);
      EXECUTE 'RESET ROLE';
      RAISE SQLSTATE 'ZZ001';
    EXCEPTION
      WHEN SQLSTATE 'ZZ001' THEN NULL;
      WHEN OTHERS THEN v_err := SQLSTATE;
    END;
    EXECUTE 'RESET ROLE';
    v_res := v_res || format('%s: %s|%s|%s', v_caso.quien, v_caso.caso, v_caso.esperado, v_err);
  END LOOP;

  INSERT INTO r234
  SELECT split_part(r, '|', 1), split_part(r, '|', 2), split_part(r, '|', 3),
         CASE WHEN split_part(r, '|', 2) = split_part(r, '|', 3) THEN 'ok' ELSE 'FALLA' END
    FROM unnest(v_res) AS r;

  IF EXISTS (SELECT 1 FROM r234 WHERE resultado = 'FALLA') THEN
    RAISE EXCEPTION E'fix-234-b: % caso(s) fallaron:\n%',
      (SELECT count(*) FROM r234 WHERE resultado = 'FALLA'),
      (SELECT string_agg(format('%s — esperado %s, obtenido %s', caso, esperado, obtenido), E'\n')
         FROM r234 WHERE resultado = 'FALLA');
  END IF;
END
$test$;

SELECT count(*) AS casos, count(*) FILTER (WHERE resultado = 'ok') AS ok FROM r234;
