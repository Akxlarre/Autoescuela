-- ============================================================================
-- Prueba de BD — fix-368-m: el instructor solo ve y escribe la asistencia de SUS clases
-- ============================================================================
-- ACs en specs/fixes/fix-368-m-asistencia-b-abierta-a-instructores/fix.md (AC1–AC4).
-- Simula cada rol con request.jwt.claims + role authenticated. Termina SIEMPRE con
-- RAISE EXCEPTION: no deja cambios. El mensaje trae el resultado ("TODO OK" o los fallos).
-- Correr como postgres, después de aplicar 20261011120000_fix368_….
-- ============================================================================

DO $test$
DECLARE
  v_instr_uid uuid; v_instr_id int;
  v_admin_uid uuid; v_sec_uid uuid; v_sec_branch int;
  v_own int;      -- asistencia de una clase del instructor
  v_foreign int;  -- asistencia de una clase de otro instructor
  v_foreign_sess int; v_foreign_student int;
  v_own_sess int; v_own_student int;
  v_sec_row int;  -- asistencia de una clase de la sede de la secretaria
  n int; n2 int;
  v_fails text := '';
  v_log text := '';
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT u.supabase_uid, i.id INTO v_instr_uid, v_instr_id
    FROM public.users u JOIN public.instructors i ON i.user_id = u.id
   WHERE u.email = 'instructor@test.com';
  SELECT supabase_uid INTO v_admin_uid FROM public.users WHERE email = 'admin@test.com';
  SELECT supabase_uid, branch_id INTO v_sec_uid, v_sec_branch FROM public.users WHERE email = 'secretaria@test.com';

  SELECT a.id INTO v_foreign FROM public.class_b_practice_attendance a
    JOIN public.class_b_sessions s ON s.id = a.class_b_session_id
   WHERE s.instructor_id <> v_instr_id ORDER BY a.id LIMIT 1;
  SELECT s.id, e.student_id INTO v_foreign_sess, v_foreign_student
    FROM public.class_b_sessions s JOIN public.enrollments e ON e.id = s.enrollment_id
   WHERE s.instructor_id <> v_instr_id
     AND NOT EXISTS (SELECT 1 FROM public.class_b_practice_attendance a WHERE a.class_b_session_id = s.id)
   ORDER BY s.id LIMIT 1;

  -- Clase propia: si el instructor de prueba no tiene asistencias, se le asigna una clase
  -- (dentro de esta transacción, que se revierte).
  SELECT a.id INTO v_own FROM public.class_b_practice_attendance a
    JOIN public.class_b_sessions s ON s.id = a.class_b_session_id
   WHERE s.instructor_id = v_instr_id ORDER BY a.id LIMIT 1;
  IF v_own IS NULL THEN
    UPDATE public.class_b_sessions SET instructor_id = v_instr_id
     WHERE id = (SELECT class_b_session_id FROM public.class_b_practice_attendance
                  WHERE id <> v_foreign ORDER BY id DESC LIMIT 1)
     RETURNING id INTO v_own_sess;
    SELECT id INTO v_own FROM public.class_b_practice_attendance WHERE class_b_session_id = v_own_sess;
  END IF;
  SELECT s.id, e.student_id INTO v_own_sess, v_own_student
    FROM public.class_b_sessions s JOIN public.enrollments e ON e.id = s.enrollment_id
   WHERE s.instructor_id = v_instr_id
     AND NOT EXISTS (SELECT 1 FROM public.class_b_practice_attendance a WHERE a.class_b_session_id = s.id)
   ORDER BY s.id LIMIT 1;
  IF v_own_sess IS NULL THEN
    -- Sin clase propia libre: se le asigna una ajena sin asistencia (se revierte al final).
    UPDATE public.class_b_sessions s SET instructor_id = v_instr_id
     WHERE s.id = (SELECT s2.id FROM public.class_b_sessions s2
                    WHERE s2.id <> v_foreign_sess
                      AND NOT EXISTS (SELECT 1 FROM public.class_b_practice_attendance a
                                       WHERE a.class_b_session_id = s2.id)
                    ORDER BY s2.id DESC LIMIT 1)
     RETURNING s.id INTO v_own_sess;
    SELECT e.student_id INTO v_own_student FROM public.class_b_sessions s
      JOIN public.enrollments e ON e.id = s.enrollment_id WHERE s.id = v_own_sess;
  END IF;

  SELECT a.id INTO v_sec_row FROM public.class_b_practice_attendance a
    JOIN public.class_b_sessions s ON s.id = a.class_b_session_id
    JOIN public.enrollments e ON e.id = s.enrollment_id
   WHERE e.branch_id = v_sec_branch ORDER BY a.id LIMIT 1;

  IF v_instr_uid IS NULL OR v_foreign IS NULL OR v_own IS NULL OR v_admin_uid IS NULL OR v_sec_row IS NULL THEN
    RAISE EXCEPTION 'Faltan datos de prueba (instr %, ajena %, propia %, sec %)', v_instr_uid, v_foreign, v_own, v_sec_row;
  END IF;

  -- ── Instructor ─────────────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_instr_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT count(*) INTO n FROM public.class_b_practice_attendance WHERE id = v_foreign;
  v_log := v_log || format('AC1 instructor lee ajena=%s; ', n);
  IF n <> 0 THEN v_fails := v_fails || 'AC1 lee ajena; '; END IF;

  SELECT count(*) INTO n FROM public.class_b_practice_attendance a
    JOIN public.class_b_sessions s ON s.id = a.class_b_session_id WHERE s.instructor_id <> v_instr_id;
  IF n <> 0 THEN v_fails := v_fails || format('AC1 ve %s ajenas; ', n); END IF;

  UPDATE public.class_b_practice_attendance SET status = status WHERE id = v_foreign;
  GET DIAGNOSTICS n = ROW_COUNT;
  v_log := v_log || format('AC2 update ajena=%s; ', n);
  IF n <> 0 THEN v_fails := v_fails || 'AC2 update ajena; '; END IF;

  IF v_foreign_sess IS NOT NULL THEN
    BEGIN
      INSERT INTO public.class_b_practice_attendance (class_b_session_id, student_id, status)
      VALUES (v_foreign_sess, v_foreign_student, 'absent');
      v_fails := v_fails || 'AC2 insert ajena permitido; ';
    EXCEPTION WHEN insufficient_privilege THEN
      v_log := v_log || 'AC2 insert ajena=rechazado; ';
    END;
  END IF;

  SELECT count(*) INTO n FROM public.class_b_practice_attendance WHERE id = v_own;
  v_log := v_log || format('AC3 lee propia=%s; ', n);
  IF n <> 1 THEN v_fails := v_fails || 'AC3 no lee propia; '; END IF;

  UPDATE public.class_b_practice_attendance SET status = status WHERE id = v_own;
  GET DIAGNOSTICS n = ROW_COUNT;
  v_log := v_log || format('AC3 update propia=%s; ', n);
  IF n <> 1 THEN v_fails := v_fails || 'AC3 no actualiza propia; '; END IF;

  IF v_own_sess IS NOT NULL THEN
    BEGIN
      INSERT INTO public.class_b_practice_attendance (class_b_session_id, student_id, status)
      VALUES (v_own_sess, v_own_student, 'present');
      v_log := v_log || 'AC3 insert propia=ok; ';
    EXCEPTION WHEN insufficient_privilege THEN
      v_fails := v_fails || 'AC3 insert propia rechazado; ';
    END;
  ELSE
    v_log := v_log || 'AC3 insert propia=sin clase libre (no probado); ';
  END IF;

  -- ── Admin ──────────────────────────────────────────────────────────────────
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO n FROM public.class_b_practice_attendance WHERE id IN (v_own, v_foreign);
  v_log := v_log || format('AC4 admin lee=%s; ', n);
  IF n <> 2 THEN v_fails := v_fails || 'AC4 admin; '; END IF;

  -- ── Secretaria (su sede) ──────────────────────────────────────────────────
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO n FROM public.class_b_practice_attendance WHERE id = v_sec_row;
  UPDATE public.class_b_practice_attendance SET status = status WHERE id = v_sec_row;
  GET DIAGNOSTICS n2 = ROW_COUNT;
  v_log := v_log || format('AC4 secretaria lee=%s update=%s; ', n, n2);
  IF n <> 1 OR n2 <> 1 THEN v_fails := v_fails || 'AC4 secretaria; '; END IF;

  PERFORM set_config('role', 'postgres', true);

  IF v_fails = '' THEN
    RAISE EXCEPTION 'RESULTADO fix-368-m: TODO OK — %', v_log;
  ELSE
    RAISE EXCEPTION 'RESULTADO fix-368-m: FALLA — % | %', v_fails, v_log;
  END IF;
END
$test$;
