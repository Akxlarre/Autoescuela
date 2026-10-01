-- ============================================================================
-- Test de RLS — spec 0047-b: aislamiento por sede para la secretaria
-- ============================================================================
-- Qué verifica (ver specs/specs/0047-b-rls-aislamiento-por-sede/spec.md):
--   AC1  una secretaria sin grant no lee filas de la otra sede
--   AC2  sus UPDATE/DELETE sobre la otra sede afectan 0 filas y sus INSERT son rechazados
--   AC3  ve exactamente las filas de su sede y puede actualizar una de ellas
--   AC4  la secretaria con grant multi-sede ve todo
--   AC5  el admin ve todo
--   AC-E3 no puede mover una fila propia a la otra sede
--
-- Cómo funciona: impersona a usuarios de prueba reales (resueltos por email) con
-- request.jwt.claims + SET LOCAL ROLE authenticated, y compara lo que ven contra la "verdad"
-- calculada como postgres (sin RLS). Termina con RAISE EXCEPTION si algún caso falla.
--
-- Es seguro correrlo contra la BD real: toda escritura se hace dentro de un sub-bloque que
-- siempre aborta (SQLSTATE ZZ001) y la deshace, aunque la RLS la haya dejado pasar. Igual se
-- recomienda envolverlo en BEGIN … ROLLBACK.
--
-- Correr como postgres (SQL editor de Supabase o MCP execute_sql).
-- ============================================================================

DO $test$
DECLARE
  v_fail   text[] := '{}';
  v_log    text[] := '{}';
  p        record;
  t        record;
  w        record;
  v_exp    int[];
  v_vis    bigint;
  v_leak   bigint;
  v_rows   bigint;
  v_state  text;
  v_s1_uid uuid;
  -- Filas objetivo para las escrituras (sede 2 = ajena para la secretaria de la sede 1)
  v_b2_student   int; v_b2_session int; v_b2_payment int; v_b2_sale int;
  v_b2_course    int; v_b2_contract int; v_b2_enrollment int;
  v_b1_session   int; v_b1_sale int; v_b2_instr int; v_b2_vehicle int;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Correr como postgres (current_user = %)', current_user;
  END IF;

  -- ── Personas ──────────────────────────────────────────────────────────────
  CREATE TEMP TABLE _personas ON COMMIT DROP AS
  SELECT x.label, u.supabase_uid AS uid, x.branch, x.scoped
  FROM (VALUES
          ('secretaria_sede1', 'secretaria@test.com',            1,    true),
          ('secretaria_sede2', 'secretaria2@test.com',           2,    true),
          ('secretaria_multi', 'secretaria.multisede@test.com',  NULL, false),
          ('admin',            'admin@test.com',                 NULL, false)
       ) AS x(label, email, branch, scoped)
  JOIN public.users u ON u.email = x.email;

  IF (SELECT count(*) FROM _personas) <> 4 THEN
    RAISE EXCEPTION 'Faltan usuarios de prueba (encontrados: %)',
      (SELECT string_agg(label, ', ') FROM _personas);
  END IF;
  SELECT uid INTO v_s1_uid FROM _personas WHERE label = 'secretaria_sede1';

  -- ── Lecturas: AC1, AC3, AC4, AC5 ─────────────────────────────────────────
  -- "scoped_sql" devuelve los ids que una secretaria SIN grant de la sede $1 debería ver.
  -- Replica branch_visible(): una fila con sede NULL es visible para todas (AC-E1).
  CREATE TEMP TABLE _lecturas ON COMMIT DROP AS
  SELECT * FROM (VALUES
    ('class_b_sessions',
     'SELECT cb.id FROM public.class_b_sessions cb JOIN public.enrollments e ON e.id = cb.enrollment_id
       WHERE e.branch_id = $1 OR e.branch_id IS NULL'),
    ('class_b_practice_attendance',
     'SELECT a.id FROM public.class_b_practice_attendance a
        JOIN public.class_b_sessions cb ON cb.id = a.class_b_session_id
        JOIN public.enrollments e ON e.id = cb.enrollment_id
       WHERE e.branch_id = $1 OR e.branch_id IS NULL'),
    ('class_b_theory_sessions',
     'SELECT id FROM public.class_b_theory_sessions WHERE branch_id = $1 OR branch_id IS NULL'),
    ('absence_evidence',
     'SELECT x.id FROM public.absence_evidence x JOIN public.enrollments e ON e.id = x.enrollment_id
       WHERE e.branch_id = $1 OR e.branch_id IS NULL'),
    ('students',
     'SELECT s.id FROM public.students s JOIN public.users u ON u.id = s.user_id WHERE u.branch_id = $1'),
    ('payments',
     'SELECT x.id FROM public.payments x JOIN public.enrollments e ON e.id = x.enrollment_id
       WHERE e.branch_id = $1 OR e.branch_id IS NULL'),
    ('discount_applications',
     'SELECT x.id FROM public.discount_applications x JOIN public.enrollments e ON e.id = x.enrollment_id
       WHERE e.branch_id = $1 OR e.branch_id IS NULL'),
    ('instructor_advances',
     'SELECT x.id FROM public.instructor_advances x
        JOIN public.instructors i ON i.id = x.instructor_id JOIN public.users u ON u.id = i.user_id
       WHERE u.branch_id = $1 OR u.branch_id IS NULL OR i.both_branches'),
    ('instructor_replacements',
     'SELECT x.id FROM public.instructor_replacements x
        JOIN public.instructors i ON i.id = x.absent_instructor_id JOIN public.users u ON u.id = i.user_id
       WHERE u.branch_id = $1 OR u.branch_id IS NULL OR i.both_branches'),
    ('special_service_sales',
     'SELECT id FROM public.special_service_sales WHERE branch_id = $1 OR branch_id IS NULL'),
    ('standalone_courses',
     'SELECT id FROM public.standalone_courses WHERE branch_id = $1 OR branch_id IS NULL'),
    ('standalone_course_enrollments',
     'SELECT x.id FROM public.standalone_course_enrollments x
        JOIN public.standalone_courses c ON c.id = x.standalone_course_id
       WHERE c.branch_id = $1 OR c.branch_id IS NULL'),
    ('school_documents',
     'SELECT id FROM public.school_documents WHERE branch_id = $1 OR branch_id IS NULL'),
    ('certificates',
     'SELECT c.id FROM public.certificates c
        LEFT JOIN public.enrollments e ON e.id = c.enrollment_id
        LEFT JOIN public.students s ON s.id = c.student_id
        LEFT JOIN public.users u ON u.id = s.user_id
       WHERE (c.enrollment_id IS NOT NULL AND (e.branch_id = $1 OR e.branch_id IS NULL))
          OR (c.enrollment_id IS NULL AND u.branch_id = $1)'),
    ('certificate_issuance_log',
     'SELECT l.id FROM public.certificate_issuance_log l
        JOIN public.certificates c ON c.id = l.certificate_id
        LEFT JOIN public.enrollments e ON e.id = c.enrollment_id
        LEFT JOIN public.students s ON s.id = c.student_id
        LEFT JOIN public.users u ON u.id = s.user_id
       WHERE (c.enrollment_id IS NOT NULL AND (e.branch_id = $1 OR e.branch_id IS NULL))
          OR (c.enrollment_id IS NULL AND u.branch_id = $1)')
  ) AS v(tbl, scoped_sql);

  FOR t IN SELECT * FROM _lecturas LOOP
    FOR p IN SELECT * FROM _personas LOOP
      EXECUTE 'RESET ROLE';
      IF p.scoped THEN
        EXECUTE format('SELECT coalesce(array_agg(id), ''{}'') FROM (%s) q', t.scoped_sql)
          INTO v_exp USING p.branch;
      ELSE
        EXECUTE format('SELECT coalesce(array_agg(id), ''{}'') FROM public.%I', t.tbl) INTO v_exp;
      END IF;

      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', p.uid, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      EXECUTE format(
        'SELECT count(*), count(*) FILTER (WHERE NOT (id = ANY($1))) FROM public.%I', t.tbl)
        INTO v_vis, v_leak USING v_exp;
      EXECUTE 'RESET ROLE';

      IF v_leak > 0 THEN
        v_fail := v_fail || format('LEER %s / %s: %s fila(s) fuera de su alcance', t.tbl, p.label, v_leak);
      ELSIF v_vis <> cardinality(v_exp) THEN
        v_fail := v_fail || format('LEER %s / %s: ve %s, esperaba %s', t.tbl, p.label, v_vis, cardinality(v_exp));
      END IF;
    END LOOP;
  END LOOP;

  -- ── Escrituras: AC2, AC3, AC-E3 (como secretaria de la sede 1) ──────────────
  EXECUTE 'RESET ROLE';
  SELECT s.id INTO v_b2_student FROM public.students s JOIN public.users u ON u.id = s.user_id
   WHERE u.branch_id = 2 LIMIT 1;
  SELECT cb.id, cb.instructor_id, cb.vehicle_id INTO v_b2_session, v_b2_instr, v_b2_vehicle
    FROM public.class_b_sessions cb JOIN public.enrollments e ON e.id = cb.enrollment_id
   WHERE e.branch_id = 2 LIMIT 1;
  SELECT cb.id INTO v_b1_session FROM public.class_b_sessions cb JOIN public.enrollments e ON e.id = cb.enrollment_id
   WHERE e.branch_id = 1 LIMIT 1;
  SELECT x.id INTO v_b2_payment FROM public.payments x JOIN public.enrollments e ON e.id = x.enrollment_id
   WHERE e.branch_id = 2 LIMIT 1;
  SELECT id INTO v_b2_sale FROM public.special_service_sales WHERE branch_id = 2 LIMIT 1;
  SELECT id INTO v_b1_sale FROM public.special_service_sales WHERE branch_id = 1 LIMIT 1;
  SELECT id INTO v_b2_course FROM public.standalone_courses WHERE branch_id = 2 LIMIT 1;
  SELECT x.id INTO v_b2_contract FROM public.digital_contracts x JOIN public.enrollments e ON e.id = x.enrollment_id
   WHERE e.branch_id = 2 LIMIT 1;
  SELECT id INTO v_b2_enrollment FROM public.enrollments WHERE branch_id = 2 LIMIT 1;

  -- expect: 'cero' = 0 filas afectadas | 'rls' = rechazo 42501 | 'una' = 1 fila (sede propia)
  CREATE TEMP TABLE _escrituras ON COMMIT DROP AS
  SELECT * FROM (VALUES
    ('UPDATE students (sede 2)',         v_b2_student,    'cero', 'UPDATE public.students SET address = address WHERE id = $1'),
    ('DELETE students (sede 2)',         v_b2_student,    'cero', 'DELETE FROM public.students WHERE id = $1'),
    ('UPDATE class_b_sessions (sede 2)', v_b2_session,    'cero', 'UPDATE public.class_b_sessions SET notes = notes WHERE id = $1'),
    ('DELETE class_b_sessions (sede 2)', v_b2_session,    'cero', 'DELETE FROM public.class_b_sessions WHERE id = $1'),
    ('UPDATE payments (sede 2)',         v_b2_payment,    'cero', 'UPDATE public.payments SET document_number = document_number WHERE id = $1'),
    ('UPDATE special_service_sales (sede 2)', v_b2_sale,  'cero', 'UPDATE public.special_service_sales SET client_name = client_name WHERE id = $1'),
    ('DELETE special_service_sales (sede 2)', v_b2_sale,  'cero', 'DELETE FROM public.special_service_sales WHERE id = $1'),
    ('UPDATE standalone_courses (sede 2)',    v_b2_course, 'cero', 'UPDATE public.standalone_courses SET name = name WHERE id = $1'),
    ('UPDATE digital_contracts (sede 2)',     v_b2_contract, 'cero', 'UPDATE public.digital_contracts SET file_name = file_name WHERE id = $1'),
    ('INSERT class_b_sessions (matrícula sede 2)', v_b2_enrollment, 'rls',
     format('INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, duration_min)
             VALUES ($1, %s, %s, 1, now() + interval ''400 days'', 45)', v_b2_instr, v_b2_vehicle)),
    ('INSERT payments (matrícula sede 2)', v_b2_enrollment, 'rls',
     'INSERT INTO public.payments (enrollment_id, total_amount) VALUES ($1, 1)'),
    ('INSERT special_service_sales (sede 2)', 2, 'rls',
     'INSERT INTO public.special_service_sales (branch_id, client_name, sale_date, price)
      VALUES ($1, ''test 0047-b'', current_date, 1)'),
    ('INSERT student_documents (matrícula sede 2)', v_b2_enrollment, 'rls',
     'INSERT INTO public.student_documents (enrollment_id, file_name, storage_url)
      VALUES ($1, ''test-0047-b.pdf'', ''test/0047-b.pdf'')'),
    ('UPDATE class_b_sessions (sede propia)', v_b1_session, 'una',
     'UPDATE public.class_b_sessions SET notes = notes WHERE id = $1'),
    ('UPDATE special_service_sales sede 1 → 2 (AC-E3)', v_b1_sale, 'rls',
     'UPDATE public.special_service_sales SET branch_id = 2 WHERE id = $1')
  ) AS v(label, target, expect, sql);

  FOR w IN SELECT * FROM _escrituras LOOP
    IF w.target IS NULL THEN
      v_log := v_log || format('SKIP %s: no hay fila objetivo', w.label);
      CONTINUE;
    END IF;
    v_rows := NULL; v_state := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_s1_uid, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      EXECUTE w.sql USING w.target;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE SQLSTATE 'ZZ001';               -- deshace siempre la escritura
    EXCEPTION
      WHEN SQLSTATE 'ZZ001' THEN v_state := 'ok';
      WHEN OTHERS THEN v_state := SQLSTATE || ' ' || SQLERRM;
    END;
    EXECUTE 'RESET ROLE';

    IF w.expect = 'cero' AND NOT (v_state = 'ok' AND v_rows = 0) THEN
      v_fail := v_fail || format('ESCRIBIR %s: esperaba 0 filas, obtuvo filas=%s estado=%s', w.label, v_rows, v_state);
    ELSIF w.expect = 'una' AND NOT (v_state = 'ok' AND v_rows = 1) THEN
      v_fail := v_fail || format('ESCRIBIR %s: esperaba 1 fila, obtuvo filas=%s estado=%s', w.label, v_rows, v_state);
    ELSIF w.expect = 'rls' AND v_state NOT LIKE '42501%' THEN
      v_fail := v_fail || format('ESCRIBIR %s: esperaba rechazo RLS (42501), obtuvo filas=%s estado=%s', w.label, v_rows, v_state);
    END IF;
  END LOOP;

  EXECUTE 'RESET ROLE';
  IF array_length(v_log, 1) > 0 THEN
    RAISE NOTICE '%', array_to_string(v_log, E'\n');
  END IF;
  IF array_length(v_fail, 1) > 0 THEN
    RAISE EXCEPTION E'0047-b: % caso(s) fallaron:\n%', array_length(v_fail, 1), array_to_string(v_fail, E'\n');
  END IF;
  RAISE NOTICE '0047-b: todos los casos pasaron';
END
$test$;
