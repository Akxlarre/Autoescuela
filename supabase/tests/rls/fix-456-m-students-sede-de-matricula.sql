-- ============================================================================
-- Test de RLS — fix-456-m: la secretaria ve a los alumnos matriculados en su sede
-- ============================================================================
-- Verifica (ver specs/fixes/fix-456-m-dms-sede-de-la-matricula/fix.md):
--   S1  secretaria sede 1 ve a todo alumno con matrícula en la sede 1, sea cual sea su users.branch_id
--   S2  secretaria sede 1 sigue viendo a los alumnos de la sede 1 sin matrícula
--   S3  secretaria sede 1 NO ve a un alumno de la sede 2 sin ninguna matrícula en la sede 1
--   S4  admin ve todos
-- Solo lecturas: no modifica nada. Correr como postgres.
-- ============================================================================

DO $test$
DECLARE
  v_fail text[] := '{}';
  v_log  text[] := '{}';
  v_sec  uuid;
  v_adm  uuid;
  v_exp  bigint;
  v_vis  bigint;
  v_leak bigint;
  v_total bigint;
  v_adm_vis bigint;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Correr como postgres (current_user = %)', current_user;
  END IF;

  SELECT supabase_uid INTO v_sec FROM public.users WHERE email = 'secretaria@test.com';
  SELECT supabase_uid INTO v_adm FROM public.users WHERE email = 'admin@test.com';

  -- Lo que la secretaria sede 1 DEBERÍA ver (calculado como postgres, sin RLS).
  CREATE TEMP TABLE _esperados ON COMMIT DROP AS
  SELECT s.id FROM public.students s JOIN public.users u ON u.id = s.user_id
   WHERE u.branch_id = 1
  UNION
  SELECT e.student_id FROM public.enrollments e WHERE e.branch_id = 1;

  SELECT count(*) INTO v_exp FROM _esperados;
  SELECT count(*) INTO v_total FROM public.students;

  -- Precondición: existe al menos un alumno de otra sede con matrícula en la sede 1.
  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments e JOIN public.students s ON s.id = e.student_id
      JOIN public.users u ON u.id = s.user_id
     WHERE e.branch_id = 1 AND u.branch_id IS DISTINCT FROM 1
  ) THEN
    v_log := v_log || 'aviso: no hay alumno de otra sede con matrícula en la sede 1 (S1 trivial)'::text;
  END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  CREATE TEMP TABLE _visibles ON COMMIT DROP AS SELECT id FROM public.students;
  EXECUTE 'RESET ROLE';

  SELECT count(*) INTO v_vis FROM _visibles v WHERE v.id IN (SELECT id FROM _esperados);
  SELECT count(*) INTO v_leak FROM _visibles v WHERE v.id NOT IN (SELECT id FROM _esperados);

  IF v_vis <> v_exp THEN
    v_fail := v_fail || format('S1/S2: esperaba ver %s alumnos, ve %s', v_exp, v_vis);
  ELSE
    v_log := v_log || format('ok S1/S2: ve los %s alumnos de su sede o con matrícula en ella', v_exp);
  END IF;
  IF v_leak > 0 THEN
    v_fail := v_fail || format('S3: ve %s alumnos sin relación con la sede 1', v_leak);
  ELSE
    v_log := v_log || 'ok S3: ningún alumno ajeno'::text;
  END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_adm_vis FROM public.students;
  EXECUTE 'RESET ROLE';

  IF v_adm_vis <> v_total THEN
    v_fail := v_fail || format('S4: admin ve %s de %s', v_adm_vis, v_total);
  ELSE
    v_log := v_log || format('ok S4: admin ve los %s', v_total);
  END IF;

  IF array_length(v_fail, 1) > 0 THEN
    RAISE EXCEPTION E'fix-456-m: % caso(s) fallaron:\n%\n---\n%',
      array_length(v_fail, 1), array_to_string(v_fail, E'\n'), array_to_string(v_log, E'\n');
  END IF;
  RAISE NOTICE E'fix-456-m: todos los casos pasaron\n%', array_to_string(v_log, E'\n');
END
$test$;
