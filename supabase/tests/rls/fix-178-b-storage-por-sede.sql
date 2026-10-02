-- ============================================================================
-- Test de RLS — fix-178-b: Storage aislado por sede
-- ============================================================================
-- Verifica (ver specs/fixes/fix-178-b-storage-aislamiento-por-sede/fix.md):
--   F1  la secretaria sin grant solo lee objetos de `documents` de su sede (+ prefijos sin sede)
--   F2  no puede subir ni sobrescribir objetos bajo rutas de la otra sede
--   F3  sede propia, secretaria multi-sede y admin intactos
--   F4  anon no puede subir a website-public/seeds/
--   F5  website-public/website-assets/branch-<otra>/ rechazado; branch-<propia>/ permitido
--
-- Igual que el test de 0047-b: impersona usuarios reales (por email) y toda escritura se hace en
-- un sub-bloque que siempre aborta (SQLSTATE ZZ001), así que no deja objetos ni modifica nada.
-- Correr como postgres. Recomendado igual: BEGIN … ROLLBACK.
-- ============================================================================

DO $test$
DECLARE
  v_fail   text[] := '{}';
  v_log    text[] := '{}';
  p        record;
  w        record;
  v_exp    bigint;
  v_vis    bigint;
  v_leak   bigint;
  v_rows   bigint;
  v_state  text;
  v_s1_uid uuid;
  v_b1_enr int; v_b2_enr int; v_b2_obj text; v_b1_obj text;
  v_ajenos text[];
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Correr como postgres (current_user = %)', current_user;
  END IF;

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
    RAISE EXCEPTION 'Faltan usuarios de prueba';
  END IF;
  SELECT uid INTO v_s1_uid FROM _personas WHERE label = 'secretaria_sede1';

  -- "Verdad" sin RLS: sede de cada objeto de `documents`, derivada de la ruta.
  -- NULL en sede = objeto sin sede (visible para cualquier secretaria); 'deny' = prefijo no
  -- permitido a la secretaria (public-uploads, placeholders).
  CREATE TEMP TABLE _obj ON COMMIT DROP AS
  SELECT o.name,
         split_part(o.name, '/', 1) AS p1,
         CASE
           WHEN split_part(o.name, '/', 1) IN ('students','contracts','certificates','certificates_prof','student-licenses')
             THEN (SELECT e.branch_id::text FROM public.enrollments e WHERE e.id::text = split_part(o.name, '/', 2))
           WHEN split_part(o.name, '/', 1) = 'sessions'
             THEN (SELECT e.branch_id::text FROM public.class_b_sessions cb JOIN public.enrollments e ON e.id = cb.enrollment_id
                    WHERE cb.id::text = split_part(o.name, '/', 2))
           WHEN split_part(o.name, '/', 1) = 'instructor-docs'
             THEN (SELECT CASE WHEN i.both_branches OR u.branch_id IS NULL THEN 'all' ELSE u.branch_id::text END
                     FROM public.instructors i JOIN public.users u ON u.id = i.user_id
                    WHERE i.id::text = split_part(o.name, '/', 2))
           WHEN split_part(o.name, '/', 1) = 'class-books'
             THEN (SELECT coalesce(pp.branch_id::text, 'all') FROM public.promotion_courses pc
                     JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                    WHERE pc.id::text = split_part(o.name, '/', 2))
           WHEN split_part(o.name, '/', 1) = 'website-assets'
             THEN replace(split_part(o.name, '/', 2), 'branch-', '')
           WHEN split_part(o.name, '/', 1) IN ('school-docs','templates','vehicle-docs')
             THEN 'all'
           ELSE 'deny'
         END AS sede
    FROM storage.objects o
   WHERE o.bucket_id = 'documents';

  -- ── F1 / F3: lecturas ─────────────────────────────────────────────────────
  FOR p IN SELECT * FROM _personas LOOP
    EXECUTE 'RESET ROLE';
    IF p.scoped THEN
      SELECT count(*) INTO v_exp FROM _obj WHERE sede = 'all' OR sede = p.branch::text;
    ELSE
      SELECT count(*) INTO v_exp FROM _obj;
    END IF;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', p.uid, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO v_vis FROM storage.objects WHERE bucket_id = 'documents';
    EXECUTE 'RESET ROLE';

    -- fuga: objetos visibles para la persona que pertenecen a otra sede o a un prefijo denegado
    IF p.scoped THEN
      SELECT coalesce(array_agg(name), '{}') INTO v_ajenos FROM _obj
       WHERE sede IS DISTINCT FROM 'all' AND sede IS DISTINCT FROM p.branch::text;
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', p.uid, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      SELECT count(*) INTO v_leak FROM storage.objects o
       WHERE o.bucket_id = 'documents' AND o.name = ANY (v_ajenos);
      EXECUTE 'RESET ROLE';
    ELSE
      v_leak := 0;
    END IF;

    IF v_leak > 0 THEN
      v_fail := v_fail || format('LEER documents / %s: %s objeto(s) fuera de su alcance', p.label, v_leak);
    ELSIF v_vis <> v_exp THEN
      v_fail := v_fail || format('LEER documents / %s: ve %s, esperaba %s', p.label, v_vis, v_exp);
    ELSE
      v_log := v_log || format('ok LEER documents / %s: %s', p.label, v_vis);
    END IF;
  END LOOP;

  -- ── F2 / F3 / F4 / F5: escrituras ─────────────────────────────────────────
  EXECUTE 'RESET ROLE';
  SELECT id INTO v_b1_enr FROM public.enrollments WHERE branch_id = 1 ORDER BY id LIMIT 1;
  SELECT id INTO v_b2_enr FROM public.enrollments WHERE branch_id = 2 ORDER BY id LIMIT 1;
  SELECT name INTO v_b2_obj FROM _obj WHERE sede = '2' AND p1 IN ('students','contracts') LIMIT 1;
  SELECT name INTO v_b1_obj FROM _obj WHERE sede = '1' AND p1 IN ('students','contracts') LIMIT 1;

  -- quien: 's1' = secretaria sede 1 | 'anon' = sin sesión
  -- expect: 'rls' = 42501 | 'una' = 1 fila | 'cero' = 0 filas
  CREATE TEMP TABLE _escrituras ON COMMIT DROP AS
  SELECT * FROM (VALUES
    ('INSERT documents students/<matrícula sede 2>', 's1', 'rls',
     format('INSERT INTO storage.objects (bucket_id, name) VALUES (''documents'', ''students/%s/test-fix178.pdf'')', v_b2_enr)),
    ('INSERT documents contracts/<matrícula sede 2>', 's1', 'rls',
     format('INSERT INTO storage.objects (bucket_id, name) VALUES (''documents'', ''contracts/%s/test-fix178.pdf'')', v_b2_enr)),
    ('INSERT documents students/<matrícula sede 1> (propia)', 's1', 'una',
     format('INSERT INTO storage.objects (bucket_id, name) VALUES (''documents'', ''students/%s/test-fix178.pdf'')', v_b1_enr)),
    ('INSERT documents prefijo desconocido', 's1', 'rls',
     'INSERT INTO storage.objects (bucket_id, name) VALUES (''documents'', ''otra-cosa/test-fix178.pdf'')'),
    ('UPDATE documents objeto de sede 2', 's1', 'cero',
     format('UPDATE storage.objects SET metadata = metadata WHERE bucket_id = ''documents'' AND name = %L', v_b2_obj)),
    ('UPDATE documents objeto de sede 1 (propio)', 's1', 'una',
     format('UPDATE storage.objects SET metadata = metadata WHERE bucket_id = ''documents'' AND name = %L', v_b1_obj)),
    ('UPDATE documents mover objeto propio a sede 2', 's1', 'rls',
     format('UPDATE storage.objects SET name = ''students/%s/movido-fix178.pdf'' WHERE bucket_id = ''documents'' AND name = %L', v_b2_enr, v_b1_obj)),
    ('INSERT website-public branch-2', 's1', 'rls',
     'INSERT INTO storage.objects (bucket_id, name) VALUES (''website-public'', ''website-assets/branch-2/test-fix178.png'')'),
    ('INSERT website-public branch-1 (propia)', 's1', 'una',
     'INSERT INTO storage.objects (bucket_id, name) VALUES (''website-public'', ''website-assets/branch-1/test-fix178.png'')'),
    ('INSERT website-public seeds/ sin sesión', 'anon', 'rls',
     'INSERT INTO storage.objects (bucket_id, name) VALUES (''website-public'', ''seeds/test-fix178.svg'')'),
    ('INSERT documents public-uploads/carnet sin sesión (wizard público)', 'anon', 'una',
     'INSERT INTO storage.objects (bucket_id, name) VALUES (''documents'', ''public-uploads/carnet/test-fix178'')')
  ) AS v(label, quien, expect, sql);

  FOR w IN SELECT * FROM _escrituras LOOP
    IF w.sql IS NULL THEN
      v_log := v_log || format('SKIP %s: sin fila objetivo', w.label);
      CONTINUE;
    END IF;
    v_rows := NULL; v_state := NULL;
    BEGIN
      IF w.quien = 'anon' THEN
        PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
        EXECUTE 'SET LOCAL ROLE anon';
      ELSE
        PERFORM set_config('request.jwt.claims',
          json_build_object('sub', v_s1_uid, 'role', 'authenticated')::text, true);
        EXECUTE 'SET LOCAL ROLE authenticated';
      END IF;
      EXECUTE w.sql;
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
    ELSE
      v_log := v_log || format('ok %s: filas=%s estado=%s', w.label, v_rows, left(v_state, 30));
    END IF;
  END LOOP;

  EXECUTE 'RESET ROLE';
  IF array_length(v_fail, 1) > 0 THEN
    RAISE EXCEPTION E'fix-178-b: % caso(s) fallaron:\n%\n---\n%',
      array_length(v_fail, 1), array_to_string(v_fail, E'\n'), array_to_string(v_log, E'\n');
  END IF;
  RAISE NOTICE E'fix-178-b: todos los casos pasaron\n%', array_to_string(v_log, E'\n');
END
$test$;
