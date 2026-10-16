-- ============================================================================
-- Test — fix-226-b: la vista de horarios se puede leer con sesión de admin y de secretaria
-- ============================================================================
-- Los tests de fix-224-b corrían como postgres y no vieron que authenticated no tenía EXECUTE
-- sobre vehicle_is_operational(). Este lee la vista impersonando usuarios reales, dentro de un
-- sub-bloque que siempre aborta (SQLSTATE ZZ001). Correr como postgres.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r226;
CREATE TEMP TABLE r226 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_res   text[] := '{}';
  v_email text;
  v_uid   uuid;
  v_n     bigint;
  v_err   text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  FOREACH v_email IN ARRAY ARRAY['admin@test.com', 'secretaria@test.com', 'secretaria2@test.com'] LOOP
    SELECT supabase_uid INTO v_uid FROM public.users WHERE email = v_email;
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Falta la cuenta de prueba %', v_email; END IF;
    v_err := 'ok';
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      SELECT count(*) INTO v_n FROM public.v_class_b_schedule_availability
       WHERE slot_start >= now() AND slot_start < now() + interval '7 days';
      EXECUTE 'RESET ROLE';
      RAISE SQLSTATE 'ZZ001';
    EXCEPTION
      WHEN SQLSTATE 'ZZ001' THEN NULL;
      WHEN OTHERS THEN v_err := SQLERRM;
    END;
    EXECUTE 'RESET ROLE';
    v_res := v_res || format('%s lee la vista de horarios|ok|%s', v_email, v_err);
  END LOOP;

  INSERT INTO r226
  SELECT split_part(r, '|', 1), split_part(r, '|', 2), split_part(r, '|', 3),
         CASE WHEN split_part(r, '|', 2) = split_part(r, '|', 3) THEN 'ok' ELSE 'FALLA' END
    FROM unnest(v_res) AS r;

  IF EXISTS (SELECT 1 FROM r226 WHERE resultado = 'FALLA') THEN
    RAISE EXCEPTION E'fix-226-b: % caso(s) fallaron:\n%',
      (SELECT count(*) FROM r226 WHERE resultado = 'FALLA'),
      (SELECT string_agg(format('%s — %s', caso, obtenido), E'\n') FROM r226 WHERE resultado = 'FALLA');
  END IF;
END
$test$;

SELECT count(*) AS casos, count(*) FILTER (WHERE resultado = 'ok') AS ok FROM r226;
