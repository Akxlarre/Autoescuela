-- ============================================================================
-- Testing fix-058-i (ASG-i-023) — Bloque 1: reglas de la BD de la matrícula presencial
-- Checklist: specs/testing-piloto/023-matricula-presencial.md (S8, S12, P04, P05).
-- Simula a secretaria@test.com (sede A) y secretaria2@test.com (sede B) con JWT en sub-bloques que
-- SIEMPRE abortan (ZZ001): no deja matrículas, pagos ni cambios. Correr como postgres.
-- Las filas con esperado "¿?" son preguntas abiertas: se reporta lo que pasa.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.rb1;
CREATE TEMP TABLE rb1 (n int, caso text, esperado text, obtenido text);

DO $test$
DECLARE
  v_rows    jsonb := '[]'::jsonb;
  v_secA    uuid;  v_branchA int;
  v_secB    uuid;  v_branchB int;
  v_enrA    int;   v_stuA int;  v_licA text;
  v_enrB    int;
  v_courseB int;
  v_new     int;
  v_n       int;
  v_txt     text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT u.supabase_uid, u.branch_id INTO v_secA, v_branchA
  FROM public.users u WHERE lower(u.email) = 'secretaria@test.com';
  SELECT u.supabase_uid, u.branch_id INTO v_secB, v_branchB
  FROM public.users u WHERE lower(u.email) = 'secretaria2@test.com';

  -- Matrícula activa en la sede A (alumno que la secretaria B intentaría matricular de nuevo)
  SELECT e.id, e.student_id, c.license_class INTO v_enrA, v_stuA, v_licA
  FROM public.enrollments e JOIN public.courses c ON c.id = e.course_id
  WHERE e.branch_id = v_branchA AND e.status = 'active'
  ORDER BY e.id DESC LIMIT 1;
  -- Una matrícula de la sede B (para los casos de RLS de la secretaria A)
  SELECT e.id INTO v_enrB FROM public.enrollments e
  WHERE e.branch_id = v_branchB AND e.status <> 'draft' ORDER BY e.id DESC LIMIT 1;
  -- Un curso de la sede B con la misma licencia (lo que elegiría la secretaria B)
  SELECT e.course_id INTO v_courseB
  FROM public.enrollments e JOIN public.courses c ON c.id = e.course_id
  WHERE e.branch_id = v_branchB AND c.license_class = v_licA
  ORDER BY e.id DESC LIMIT 1;

  IF v_secA IS NULL OR v_secB IS NULL OR v_branchA = v_branchB OR v_enrA IS NULL OR v_enrB IS NULL THEN
    RAISE EXCEPTION 'Faltan las secretarias de prueba en sedes distintas o matrículas en cada sede';
  END IF;

  -- ── 1 · S8: la limpieza de un borrador vencido borra su pago cobrado ──────────
  BEGIN
    UPDATE public.enrollments SET status = 'draft', expires_at = NOW() - interval '1 hour'
    WHERE id = v_enrA;
    INSERT INTO public.payments (enrollment_id, type, total_amount, cash_amount, status, payment_date)
    VALUES (v_enrA, 'enrollment', 1000, 1000, 'paid', public.chile_today());
    PERFORM public.cleanup_expired_drafts();
    SELECT count(*) INTO v_n FROM public.payments WHERE enrollment_id = v_enrA;
    v_txt := CASE WHEN v_n = 0 THEN 'pagos borrados' ELSE v_n || ' pago(s) conservados' END;
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
            WHEN OTHERS THEN v_txt := 'error: ' || SQLERRM;
  END;
  v_rows := v_rows || jsonb_build_object('n', 1,
    'caso', 'S8 borrador vencido con pago cobrado → limpieza nocturna',
    'esperado', '¿?', 'obtenido', v_txt);

  -- ── 2 · S8 en datos reales: borradores que hoy tienen pagos cobrados ─────────
  SELECT count(DISTINCT e.id) || ' borrador(es), ' ||
         COALESCE(sum(p.total_amount), 0) || ' pesos cobrados, ' ||
         count(DISTINCT e.id) FILTER (WHERE e.expires_at < NOW()) || ' ya vencido(s)'
  INTO v_txt
  FROM public.enrollments e JOIN public.payments p ON p.enrollment_id = e.id AND p.status = 'paid'
  WHERE e.status = 'draft';
  v_rows := v_rows || jsonb_build_object('n', 2,
    'caso', 'S8 hoy: borradores con pagos cobrados (lo que borraría la limpieza)',
    'esperado', '¿?', 'obtenido', v_txt);

  -- ── 3 · P04 / S12: la secretaria B ve la matrícula activa del alumno en la sede A ──
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_secB, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO v_n FROM public.enrollments WHERE student_id = v_stuA;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
            WHEN OTHERS THEN v_n := -1;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 3,
    'caso', 'P04 secretaria B lee las matrículas de un alumno de la sede A (filas)',
    'esperado', '0', 'obtenido', v_n::text);

  -- ── 4 · S12: la secretaria B encuentra al alumno por su RUT (users) ───────────
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_secB, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO v_n FROM public.users u
    WHERE u.id = (SELECT s.user_id FROM public.students s WHERE s.id = v_stuA);
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
            WHEN OTHERS THEN v_n := -1;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 4,
    'caso', 'S12 secretaria B encuentra al alumno de la sede A por RUT (filas de users)',
    'esperado', '¿?', 'obtenido', v_n::text);

  -- ── 5 · S12: la secretaria B le crea un borrador del mismo tipo de curso en su sede ──
  v_txt := 'sin curso de la misma licencia en la sede B';
  IF v_courseB IS NOT NULL THEN
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_secB, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      v_txt := 'insertó (queda duplicada)';
      BEGIN
        INSERT INTO public.enrollments (student_id, course_id, branch_id, base_price, discount,
          total_paid, status, expires_at, docs_complete, contract_accepted, certificate_enabled,
          registration_channel)
        VALUES (v_stuA, v_courseB, v_branchB, 100000, 0, 0, 'draft', NOW() + interval '14 hours',
          false, false, false, 'in_person')
        RETURNING id INTO v_new;
      EXCEPTION WHEN OTHERS THEN v_txt := 'rechazado: ' || SQLERRM;
      END;
      EXECUTE 'RESET ROLE';
      RAISE EXCEPTION USING ERRCODE = 'ZZ001';
    EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
    END;
    EXECUTE 'RESET ROLE';
  END IF;
  v_rows := v_rows || jsonb_build_object('n', 5,
    'caso', 'S12 secretaria B crea otra matrícula (' || COALESCE(v_licA, '?') || ') a un alumno con una activa en la sede A',
    'esperado', '¿?', 'obtenido', v_txt);

  -- ── 6 · P04: la secretaria A modifica una matrícula de la sede B ─────────────
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_secA, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.enrollments SET discount = discount WHERE id = v_enrB;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
            WHEN OTHERS THEN v_n := -1;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 6,
    'caso', 'P04 secretaria A modifica una matrícula de la sede B (filas cambiadas)',
    'esperado', '0', 'obtenido', v_n::text);

  -- ── 7 · P05: la secretaria A descarta un borrador de la sede B ───────────────
  BEGIN
    UPDATE public.enrollments SET status = 'draft' WHERE id = v_enrB;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_secA, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    DELETE FROM public.enrollments WHERE id = v_enrB;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
            WHEN OTHERS THEN v_n := -1;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_object('n', 7,
    'caso', 'P05 secretaria A descarta un borrador de la sede B (filas borradas)',
    'esperado', '0', 'obtenido', v_n::text);

  INSERT INTO rb1 (n, caso, esperado, obtenido)
  SELECT n, caso, esperado, obtenido
  FROM jsonb_to_recordset(v_rows) AS t(n int, caso text, esperado text, obtenido text);
END;
$test$;

SELECT n, caso, esperado, obtenido,
       CASE WHEN esperado = '¿?' THEN 'pregunta'
            WHEN obtenido IS NOT DISTINCT FROM esperado THEN '✅' ELSE '❌' END AS resultado
FROM rb1
ORDER BY n;
