-- ============================================================================
-- Test — fix-233-b: la secretaria manda tareas a un instructor "ambas sedes" de la otra sede
-- ============================================================================
-- Impersona a secretaria@test.com (sede 1) en sub-bloques que siempre abortan (SQLSTATE ZZ001):
-- el cambio de both_branches y las tareas creadas se deshacen. Correr como postgres.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r233;
CREATE TEMP TABLE r233 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_res     text[] := '{}';
  v_sec     record;
  v_otra    int;   -- users.id de un instructor de la sede 2
  v_misma   int;   -- users.id de un instructor de la sede 1
  v_caso    record;
  v_err     text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT id, supabase_uid, branch_id INTO v_sec FROM public.users WHERE email = 'secretaria@test.com';
  IF v_sec.branch_id IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'secretaria@test.com debe ser de la sede 1'; END IF;

  SELECT u.id INTO v_otra FROM public.instructors i JOIN public.users u ON u.id = i.user_id
   WHERE u.active AND u.branch_id = 2 ORDER BY u.id LIMIT 1;
  SELECT u.id INTO v_misma FROM public.instructors i JOIN public.users u ON u.id = i.user_id
   WHERE u.active AND u.branch_id = 1 ORDER BY u.id LIMIT 1;
  IF v_otra IS NULL OR v_misma IS NULL THEN RAISE EXCEPTION 'Faltan instructores activos en las sedes 1 y 2'; END IF;

  FOR v_caso IN
    SELECT * FROM (VALUES
      ('instructor de la otra sede con "ambas sedes"', v_otra, true, 'ok'),
      ('instructor de la otra sede sin "ambas sedes"', v_otra, false, '42501'),
      ('instructor de la misma sede', v_misma, false, 'ok')
    ) AS t(caso, destinatario, ambas, esperado)
  LOOP
    v_err := 'ok';
    BEGIN
      UPDATE public.instructors SET both_branches = v_caso.ambas WHERE user_id = v_caso.destinatario;
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_sec.supabase_uid, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      INSERT INTO public.tasks (branch_id, from_user_id, from_role, to_user_id, to_role, type, subject, status)
      VALUES (1, v_sec.id, 'secretary', v_caso.destinatario, 'instructor', 'task', 'E2E-fix233', 'pending');
      EXECUTE 'RESET ROLE';
      RAISE SQLSTATE 'ZZ001';
    EXCEPTION
      WHEN SQLSTATE 'ZZ001' THEN NULL;
      WHEN OTHERS THEN v_err := SQLSTATE;
    END;
    EXECUTE 'RESET ROLE';
    v_res := v_res || format('%s|%s|%s', v_caso.caso, v_caso.esperado, v_err);
  END LOOP;

  INSERT INTO r233
  SELECT split_part(r, '|', 1), split_part(r, '|', 2), split_part(r, '|', 3),
         CASE WHEN split_part(r, '|', 2) = split_part(r, '|', 3) THEN 'ok' ELSE 'FALLA' END
    FROM unnest(v_res) AS r;

  IF EXISTS (SELECT 1 FROM r233 WHERE resultado = 'FALLA') THEN
    RAISE EXCEPTION E'fix-233-b: % caso(s) fallaron:\n%',
      (SELECT count(*) FROM r233 WHERE resultado = 'FALLA'),
      (SELECT string_agg(format('%s — esperado %s, obtenido %s', caso, esperado, obtenido), E'\n')
         FROM r233 WHERE resultado = 'FALLA');
  END IF;
END
$test$;

SELECT count(*) AS casos, count(*) FILTER (WHERE resultado = 'ok') AS ok FROM r233;
