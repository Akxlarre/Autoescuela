-- ============================================================================
-- Test de RLS — fix-179-b: la secretaria solo edita alumnos y no toca columnas de acceso
-- ============================================================================
-- Verifica (ver specs/fixes/fix-179-b-edicion-usuarios-sin-validar-objetivo/fix.md):
--   F3  la secretaria no actualiza filas de otra secretaria, un instructor ni un admin, y no
--       puede promover a un alumno a otro rol
--   F4  con sesión de secretaria no se puede fijar/cambiar can_access_both_branches ni
--       supabase_uid (INSERT y UPDATE); admin y service role sí
--   F5  matrícula (crear/editar alumno) y pre-inscritos (role_id NULL → alumno) siguen funcionando
--
-- Impersona usuarios reales (por email). Toda escritura corre en un sub-bloque que siempre aborta
-- (SQLSTATE ZZ001), así que no deja cambios. Correr como postgres; recomendado BEGIN … ROLLBACK.
-- ============================================================================

DO $test$
DECLARE
  v_fail   text[] := '{}';
  v_log    text[] := '{}';
  w        record;
  v_rows   bigint;
  v_state  text;
  v_uid    jsonb;
  v_s1     uuid;  v_admin uuid;
  v_role_student int; v_role_secretary int;
  v_other_sec int; v_b1_instr int; v_b1_student int;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Correr como postgres (current_user = %)', current_user;
  END IF;

  SELECT supabase_uid INTO v_s1    FROM public.users WHERE email = 'secretaria@test.com';
  SELECT supabase_uid INTO v_admin FROM public.users WHERE email = 'admin@test.com';
  SELECT id INTO v_role_student   FROM public.roles WHERE name = 'student';
  SELECT id INTO v_role_secretary FROM public.roles WHERE name = 'secretary';
  -- Objetivos en la sede 1 (la de la secretaria): otra secretaria, un instructor y un alumno.
  SELECT u.id INTO v_other_sec FROM public.users u
   WHERE u.role_id = v_role_secretary AND u.branch_id = 1 AND u.supabase_uid <> v_s1
     AND NOT u.can_access_both_branches LIMIT 1;
  SELECT u.id INTO v_b1_instr FROM public.users u JOIN public.roles r ON r.id = u.role_id
   WHERE r.name = 'instructor' AND u.branch_id = 1 LIMIT 1;
  SELECT u.id INTO v_b1_student FROM public.users u
   WHERE u.role_id = v_role_student AND u.branch_id = 1 LIMIT 1;

  IF v_s1 IS NULL OR v_admin IS NULL OR v_other_sec IS NULL OR v_b1_instr IS NULL OR v_b1_student IS NULL THEN
    RAISE EXCEPTION 'Faltan datos de prueba (s1=%, admin=%, otra_sec=%, instr=%, alumno=%)',
      v_s1, v_admin, v_other_sec, v_b1_instr, v_b1_student;
  END IF;

  -- quien: 's1' | 'admin' | 'service'
  -- expect: 'cero' = 0 filas | 'una' = 1 fila | 'rls' = 42501
  -- pre: SQL que corre como postgres dentro del mismo sub-bloque antes de impersonar (o NULL)
  CREATE TEMP TABLE _casos ON COMMIT DROP AS
  SELECT * FROM (VALUES
    -- F3: filas que no son de alumnos
    ('F3 UPDATE otra secretaria de su sede', 's1', 'cero', NULL,
     format('UPDATE public.users SET phone = phone WHERE id = %s', v_other_sec)),
    ('F3 UPDATE instructor de su sede', 's1', 'cero', NULL,
     format('UPDATE public.users SET email = ''tomado@test.invalid'' WHERE id = %s', v_b1_instr)),
    ('F3 promover alumno a secretaria', 's1', 'rls', NULL,
     format('UPDATE public.users SET role_id = %s WHERE id = %s', v_role_secretary, v_b1_student)),
    -- F4: columnas de acceso
    ('F4 UPDATE alumno can_access_both_branches = true', 's1', 'rls', NULL,
     format('UPDATE public.users SET can_access_both_branches = true WHERE id = %s', v_b1_student)),
    ('F4 UPDATE alumno supabase_uid = otra cuenta de Auth', 's1', 'rls', NULL,
     format('UPDATE public.users SET supabase_uid = gen_random_uuid() WHERE id = %s', v_b1_student)),
    ('F4 INSERT alumno con can_access_both_branches = true', 's1', 'rls', NULL,
     format('INSERT INTO public.users (rut, first_names, paternal_last_name, email, role_id, branch_id, can_access_both_branches)
             VALUES (''99999179-9'', ''Test'', ''Fix179'', ''fix179@test.invalid'', %s, 1, true)', v_role_student)),
    ('F4 admin sí cambia can_access_both_branches', 'admin', 'una', NULL,
     format('UPDATE public.users SET can_access_both_branches = can_access_both_branches WHERE id = %s', v_other_sec)),
    ('F4 service role sí vincula supabase_uid', 'service', 'una', NULL,
     format('UPDATE public.users SET supabase_uid = supabase_uid, can_access_both_branches = false WHERE id = %s', v_b1_student)),
    -- F5: flujos legítimos de la secretaria
    ('F5 UPDATE alumno de su sede (matrícula)', 's1', 'una', NULL,
     format('UPDATE public.users SET phone = phone, first_names = first_names WHERE id = %s', v_b1_student)),
    ('F5 INSERT alumno nuevo (matrícula)', 's1', 'una', NULL,
     format('INSERT INTO public.users (rut, first_names, paternal_last_name, email, role_id, branch_id, active, first_login)
             VALUES (''99999179-9'', ''Test'', ''Fix179'', ''fix179@test.invalid'', %s, 1, true, true)', v_role_student)),
    ('F5 pre-inscrito: role_id NULL → alumno, active = true', 's1', 'una',
     'INSERT INTO public.users (id, rut, first_names, paternal_last_name, email, role_id, branch_id, active)
      VALUES (-179, ''99999178-7'', ''Pre'', ''Fix179'', ''pre179@test.invalid'', NULL, 1, false)',
     format('UPDATE public.users SET role_id = %s, active = true, branch_id = 1 WHERE id = -179', v_role_student))
  ) AS v(label, quien, expect, pre, sql);

  FOR w IN SELECT * FROM _casos LOOP
    v_rows := NULL; v_state := NULL;
    BEGIN
      IF w.pre IS NOT NULL THEN EXECUTE w.pre; END IF;
      IF w.quien = 'service' THEN
        PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
        EXECUTE 'SET LOCAL ROLE service_role';
      ELSE
        PERFORM set_config('request.jwt.claims', json_build_object(
          'sub', CASE w.quien WHEN 'admin' THEN v_admin ELSE v_s1 END, 'role', 'authenticated')::text, true);
        EXECUTE 'SET LOCAL ROLE authenticated';
      END IF;
      EXECUTE w.sql;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE SQLSTATE 'ZZ001';               -- deshace siempre la escritura (y el pre)
    EXCEPTION
      WHEN SQLSTATE 'ZZ001' THEN v_state := 'ok';
      WHEN OTHERS THEN v_state := SQLSTATE || ' ' || SQLERRM;
    END;
    EXECUTE 'RESET ROLE';

    IF w.expect = 'cero' AND NOT (v_state = 'ok' AND v_rows = 0) THEN
      v_fail := v_fail || format('%s: esperaba 0 filas, obtuvo filas=%s estado=%s', w.label, v_rows, v_state);
    ELSIF w.expect = 'una' AND NOT (v_state = 'ok' AND v_rows = 1) THEN
      v_fail := v_fail || format('%s: esperaba 1 fila, obtuvo filas=%s estado=%s', w.label, v_rows, v_state);
    ELSIF w.expect = 'rls' AND v_state NOT LIKE '42501%' THEN
      v_fail := v_fail || format('%s: esperaba rechazo (42501), obtuvo filas=%s estado=%s', w.label, v_rows, v_state);
    ELSE
      v_log := v_log || format('ok %s: filas=%s estado=%s', w.label, v_rows, left(v_state, 40));
    END IF;
  END LOOP;

  EXECUTE 'RESET ROLE';
  IF array_length(v_fail, 1) > 0 THEN
    RAISE EXCEPTION E'fix-179-b: % caso(s) fallaron:\n%\n---\n%',
      array_length(v_fail, 1), array_to_string(v_fail, E'\n'), array_to_string(v_log, E'\n');
  END IF;
  RAISE NOTICE E'fix-179-b: todos los casos pasaron\n%', array_to_string(v_log, E'\n');
END
$test$;
