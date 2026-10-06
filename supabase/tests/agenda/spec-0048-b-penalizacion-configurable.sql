-- ============================================================================
-- Prueba de BD — spec 0048-b: cancelación automática por inasistencias configurable por sede
-- ============================================================================
-- ACs en specs/specs/0048-b-penalizacion-inasistencias-configurable/spec.md (AC1-AC4, AC6, AC-E1).
-- AC5 (el cron sigue cerrando el día) no se prueba acá: mark_end_of_day_class_b_absences() no cambia.
--
-- Usa una matrícula B activa de la sede 1 SIN clases (para no depender de datos existentes) y le
-- crea: clase 1 y 2 pasadas en no_show con asistencia "Ausente", y clase 3 futura agendada.
-- Cada caso corre en un sub-bloque que SIEMPRE aborta (ZZ001): no deja cambios.
-- Correr como postgres. Resultado en la tabla temporal r048 (último SELECT); "FALLA" = ❌.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r048;
CREATE TEMP TABLE r048 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_enr int; v_student int; v_c3 int; v_ret int; v_status text;
  v_n bigint; v_since timestamptz; v_upd bigint; v_by int;
  v_admin_uid uuid; v_admin_id int; v_sec_uid uuid;
  -- 06:07 UTC (≈03:07 Chile) hace 10 días: fuera de la grilla, no choca con clases reales.
  v_base timestamptz := date_trunc('day', now()) - interval '10 days' + interval '6 hours 7 minutes';

BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT e.id, e.student_id INTO v_enr, v_student
    FROM public.enrollments e JOIN public.courses c ON c.id = e.course_id
   WHERE c.type = 'class_b' AND e.status = 'active' AND e.branch_id = 1
     AND NOT EXISTS (SELECT 1 FROM public.class_b_sessions cb WHERE cb.enrollment_id = e.id)
   ORDER BY e.id LIMIT 1;
  SELECT supabase_uid, id INTO v_admin_uid, v_admin_id FROM public.users WHERE email = 'admin@test.com';
  SELECT supabase_uid INTO v_sec_uid FROM public.users WHERE email = 'secretaria@test.com';
  IF v_enr IS NULL OR v_admin_uid IS NULL OR v_sec_uid IS NULL THEN
    RAISE EXCEPTION 'Faltan datos de prueba (enr=%, admin=%, sec=%)', v_enr, v_admin_uid, v_sec_uid;
  END IF;

  -- ── AC1: una fila por sede, desactivada ──────────────────────────────────
  SELECT count(*) INTO v_n FROM public.branches b
   WHERE NOT EXISTS (SELECT 1 FROM public.branch_absence_penalty_config c WHERE c.branch_id = b.id);
  INSERT INTO r048 VALUES ('AC1 sedes sin fila de configuración', '0', v_n::text, CASE WHEN v_n = 0 THEN 'ok' ELSE 'FALLA' END);

  -- Escenario: clase 1 y 2 en no_show con "Ausente", clase 3 agendada a futuro.
  -- (Se recrea en cada sub-bloque: cada uno se deshace al terminar.)

  -- ── AC2: desactivada → -1 y no se cancela nada ──────────────────────────
  BEGIN
    UPDATE public.branch_absence_penalty_config SET auto_cancel_enabled = false WHERE branch_id = 1;
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_enr, 222, 1, 1, v_base, 'no_show'), (v_enr, 222, 1, 2, v_base + interval '1 day', 'no_show');
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_enr, 222, 1, 3, now() + interval '400 days', 'scheduled') RETURNING id INTO v_c3;
    INSERT INTO public.class_b_practice_attendance (class_b_session_id, student_id, status)
    SELECT id, v_student, 'absent' FROM public.class_b_sessions WHERE enrollment_id = v_enr AND class_number IN (1, 2);
    v_ret := public.apply_class_b_absence_penalty(v_enr);
    SELECT status INTO v_status FROM public.class_b_sessions WHERE id = v_c3;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r048 VALUES ('AC2 desactivada', '-1 / clase 3 scheduled', v_ret || ' / ' || v_status,
    CASE WHEN v_ret = -1 AND v_status = 'scheduled' THEN 'ok' ELSE 'FALLA' END);

  -- ── AC3: activada + faltas después de activar → cancela ─────────────────
  v_ret := NULL; v_status := NULL;
  BEGIN
    UPDATE public.branch_absence_penalty_config SET auto_cancel_enabled = true WHERE branch_id = 1;
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_enr, 222, 1, 1, v_base, 'no_show'), (v_enr, 222, 1, 2, v_base + interval '1 day', 'no_show');
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_enr, 222, 1, 3, now() + interval '400 days', 'scheduled') RETURNING id INTO v_c3;
    INSERT INTO public.class_b_practice_attendance (class_b_session_id, student_id, status)
    SELECT id, v_student, 'absent' FROM public.class_b_sessions WHERE enrollment_id = v_enr AND class_number IN (1, 2);
    v_ret := public.apply_class_b_absence_penalty(v_enr);
    SELECT status INTO v_status FROM public.class_b_sessions WHERE id = v_c3;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r048 VALUES ('AC3 activada', '1 / clase 3 cancelled', v_ret || ' / ' || v_status,
    CASE WHEN v_ret = 1 AND v_status = 'cancelled' THEN 'ok' ELSE 'FALLA' END);

  -- ── AC4: activada, pero las faltas son anteriores a la activación → no cancela ──
  v_ret := NULL; v_status := NULL;
  BEGIN
    UPDATE public.branch_absence_penalty_config SET auto_cancel_enabled = true WHERE branch_id = 1;
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_enr, 222, 1, 1, v_base, 'no_show'), (v_enr, 222, 1, 2, v_base + interval '1 day', 'no_show');
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_enr, 222, 1, 3, now() + interval '400 days', 'scheduled') RETURNING id INTO v_c3;
    INSERT INTO public.class_b_practice_attendance (class_b_session_id, student_id, status, recorded_at)
    SELECT id, v_student, 'absent', now() - interval '1 day'
      FROM public.class_b_sessions WHERE enrollment_id = v_enr AND class_number IN (1, 2);
    v_ret := public.apply_class_b_absence_penalty(v_enr);
    SELECT status INTO v_status FROM public.class_b_sessions WHERE id = v_c3;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r048 VALUES ('AC4 faltas anteriores a la activación', '0 / clase 3 scheduled', v_ret || ' / ' || v_status,
    CASE WHEN v_ret = 0 AND v_status = 'scheduled' THEN 'ok' ELSE 'FALLA' END);

  -- ── AC4: activar fija enabled_since; desactivar lo limpia ───────────────
  v_since := NULL; v_n := NULL;
  BEGIN
    UPDATE public.branch_absence_penalty_config SET auto_cancel_enabled = true WHERE branch_id = 1;
    SELECT enabled_since INTO v_since FROM public.branch_absence_penalty_config WHERE branch_id = 1;
    UPDATE public.branch_absence_penalty_config SET auto_cancel_enabled = false WHERE branch_id = 1;
    SELECT count(*) INTO v_n FROM public.branch_absence_penalty_config WHERE branch_id = 1 AND enabled_since IS NULL;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r048 VALUES ('AC4 enabled_since al activar / NULL al desactivar', 'fecha / 1',
    coalesce(v_since::text, 'NULL') || ' / ' || v_n,
    CASE WHEN v_since IS NOT NULL AND v_n = 1 THEN 'ok' ELSE 'FALLA' END);

  -- ── AC6: la secretaria no puede cambiarla; el admin sí y queda registrado ──
  v_upd := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec_uid, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.branch_absence_penalty_config SET auto_cancel_enabled = true WHERE branch_id = 1;
    GET DIAGNOSTICS v_upd = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  EXECUTE 'RESET ROLE';
  INSERT INTO r048 VALUES ('AC6 secretaria intenta activar', '0 filas', coalesce(v_upd::text, 'error'),
    CASE WHEN v_upd = 0 THEN 'ok' ELSE 'FALLA' END);

  v_upd := NULL; v_by := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_uid, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.branch_absence_penalty_config SET auto_cancel_enabled = true, updated_by = NULL WHERE branch_id = 1;
    GET DIAGNOSTICS v_upd = ROW_COUNT;
    SELECT updated_by INTO v_by FROM public.branch_absence_penalty_config WHERE branch_id = 1;
    EXECUTE 'RESET ROLE';
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  EXECUTE 'RESET ROLE';
  INSERT INTO r048 VALUES ('AC6 admin activa (updated_by lo pone el trigger)', '1 fila / ' || v_admin_id,
    coalesce(v_upd::text, 'error') || ' / ' || coalesce(v_by::text, 'NULL'),
    CASE WHEN v_upd = 1 AND v_by = v_admin_id THEN 'ok' ELSE 'FALLA' END);

  -- ── AC-E1: sede sin fila de configuración → -1 ──────────────────────────
  v_ret := NULL;
  BEGIN
    DELETE FROM public.branch_absence_penalty_config WHERE branch_id = 1;
    v_ret := public.apply_class_b_absence_penalty(v_enr);
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r048 VALUES ('AC-E1 sede sin configuración', '-1', coalesce(v_ret::text, 'NULL'),
    CASE WHEN v_ret = -1 THEN 'ok' ELSE 'FALLA' END);
END
$test$;

SELECT * FROM r048;
