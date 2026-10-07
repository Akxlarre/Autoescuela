-- ============================================================================
-- Prueba de BD — fix-212-b: secretary_last_sign_in() (último acceso real de secretarias)
-- ============================================================================
-- ACs en specs/fixes/fix-212-b-secretaria-ultimo-acceso-real/fix.md (F1).
-- Solo lectura. Correr como postgres. Resultado en la tabla temporal r212 (último SELECT);
-- "FALLA" = ❌. Cuentas: admin@test.com (admin), secretaria@test.com y secretaria2@test.com.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r212;
CREATE TEMP TABLE r212 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_admin_uid uuid;
  v_sec2_uid  uuid;
  v_admin_id  int;
  v_sec1_id   int;
  v_sec1_real timestamptz;
  v_got       timestamptz;
  v_n_admin   int;
  v_n_sec     int;
  v_n_anon    int;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;
  SELECT id, supabase_uid INTO v_admin_id, v_admin_uid FROM public.users WHERE email = 'admin@test.com';
  SELECT supabase_uid INTO v_sec2_uid FROM public.users WHERE email = 'secretaria2@test.com';
  SELECT u.id, a.last_sign_in_at INTO v_sec1_id, v_sec1_real
    FROM public.users u JOIN auth.users a ON a.id = u.supabase_uid
   WHERE u.email = 'secretaria@test.com';

  INSERT INTO r212 VALUES ('F1 privilegios', 'anon ✗ · authenticated ✓',
    format('anon %s · authenticated %s',
      has_function_privilege('anon', 'public.secretary_last_sign_in(integer[])', 'EXECUTE'),
      has_function_privilege('authenticated', 'public.secretary_last_sign_in(integer[])', 'EXECUTE')),
    CASE WHEN NOT has_function_privilege('anon', 'public.secretary_last_sign_in(integer[])', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.secretary_last_sign_in(integer[])', 'EXECUTE')
         THEN 'ok' ELSE 'FALLA' END);

  -- Admin: ve el login real de la secretaria; el de otro rol (él mismo) no sale.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT f.last_sign_in_at INTO v_got FROM public.secretary_last_sign_in(ARRAY[v_sec1_id]) f;
  SELECT count(*) INTO v_n_admin FROM public.secretary_last_sign_in(ARRAY[v_admin_id]) f;
  RESET ROLE;
  INSERT INTO r212 VALUES ('F1 admin ve el último login real de la secretaria',
    coalesce(v_sec1_real::text, '(null)'), coalesce(v_got::text, '(null)'),
    CASE WHEN v_got IS NOT DISTINCT FROM v_sec1_real AND v_sec1_real IS NOT NULL THEN 'ok' ELSE 'FALLA' END);
  INSERT INTO r212 VALUES ('F1 admin no ve logins de otros roles', '0', v_n_admin::text,
    CASE WHEN v_n_admin = 0 THEN 'ok' ELSE 'FALLA' END);

  -- Secretaria: no ve nada (ni de otra secretaria).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec2_uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n_sec FROM public.secretary_last_sign_in(ARRAY[v_sec1_id]) f;
  RESET ROLE;
  INSERT INTO r212 VALUES ('F1 una secretaria no ve nada', '0', v_n_sec::text,
    CASE WHEN v_n_sec = 0 THEN 'ok' ELSE 'FALLA' END);

  -- Sin sesión (authenticated sin sub).
  PERFORM set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n_anon FROM public.secretary_last_sign_in(ARRAY[v_sec1_id]) f;
  RESET ROLE;
  INSERT INTO r212 VALUES ('F1 sin sesión no ve nada', '0', v_n_anon::text,
    CASE WHEN v_n_anon = 0 THEN 'ok' ELSE 'FALLA' END);
END $test$;

SELECT * FROM r212 ORDER BY caso;
