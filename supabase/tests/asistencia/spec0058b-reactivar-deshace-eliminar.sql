-- ============================================================================
-- Prueba de BD — spec 0058-b: "Reactivar horario" deshace solo el último "Eliminar horario"
-- ============================================================================
-- ACs en specs/specs/0058-b-reactivar-horario-deshace-eliminar/spec.md (AC1–AC4, AC8, AC-E1–AC-E4).
-- Crea sus propias matrículas y clases, llama a las RPCs como secretaria@test.com (sede 1),
-- secretaria2@test.com (sede 2), admin@test.com e instructor@test.com, y termina SIEMPRE con
-- RAISE EXCEPTION: no deja cambios. Correr como postgres, después de aplicar
-- 20261109180000_spec0058b_reactivar_deshace_eliminar.sql.
-- ============================================================================

CREATE FUNCTION pg_temp.enr(p_template int) RETURNS int
LANGUAGE sql AS $$
  INSERT INTO public.enrollments (number, student_id, course_id, branch_id, base_price, discount,
    total_paid, pending_balance, payment_status, status, docs_complete, contract_accepted,
    registration_channel, license_group)
  SELECT 'T058-' || floor(random() * 1e9)::text, student_id, course_id, branch_id, base_price, 0,
    base_price, 0, 'paid', 'active', true, true, 'in_person', 'class_b'
  FROM public.enrollments WHERE id = p_template
  RETURNING id $$;

CREATE FUNCTION pg_temp.dia(p_offset int) RETURNS timestamptz LANGUAGE sql AS $$
  SELECT public.chile_day_start(public.chile_today() + p_offset) + interval '5 hours 10 minutes' $$;

CREATE FUNCTION pg_temp.ses(p_enr int, p_n int, p_at timestamptz, p_status text,
  p_instr int, p_veh int) RETURNS int
LANGUAGE sql AS $$
  INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number,
    scheduled_at, status)
  VALUES (p_enr, p_instr, p_veh, p_n, p_at, p_status) RETURNING id $$;

CREATE FUNCTION pg_temp.como(p_email text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', (SELECT supabase_uid FROM public.users WHERE email = p_email), 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;

DO $test$
DECLARE
  v_tpl int; v_instr int; v_veh int; v_sec int; v_instr_user int;
  e1 int; e2 int; e3 int;
  s1 int; s2 int; s_auto int; s_e2 int; t1 int; t3 int;
  v_rem record; v_rea record;
  v_removal int; v_stamp_a timestamptz;
  v_past timestamptz; v_items jsonb;
  n int;
  v_fails text := '';
  v_log text := '';
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT e.id INTO v_tpl FROM public.enrollments e
  WHERE e.status = 'active' AND e.branch_id = 1 AND e.license_group = 'class_b'
  ORDER BY e.id DESC LIMIT 1;
  SELECT cs.instructor_id, cs.vehicle_id INTO v_instr, v_veh
  FROM public.class_b_sessions cs JOIN public.enrollments e ON e.id = cs.enrollment_id
  WHERE e.branch_id = 1 ORDER BY cs.id DESC LIMIT 1;
  SELECT id INTO v_sec FROM public.users WHERE email = 'secretaria@test.com';
  SELECT user_id INTO v_instr_user FROM public.instructors WHERE id = v_instr;

  -- e1: 2 clases futuras agendadas + 1 cancelada "por la penalización automática" (sin vínculo).
  e1 := pg_temp.enr(v_tpl);
  UPDATE public.enrollments SET absence_penalty_applied_at = NULL WHERE id = e1;
  s1     := pg_temp.ses(e1, 1, pg_temp.dia(800), 'scheduled', v_instr, v_veh);
  s2     := pg_temp.ses(e1, 2, pg_temp.dia(801), 'scheduled', v_instr, v_veh);
  s_auto := pg_temp.ses(e1, 3, pg_temp.dia(802), 'cancelled', v_instr, v_veh);
  -- e2: solo una cancelada sin vínculo (penalización automática / feriado / instructor).
  e2 := pg_temp.enr(v_tpl);
  s_e2 := pg_temp.ses(e2, 1, pg_temp.dia(810), 'cancelled', v_instr, v_veh);

  -- ── AC8: el instructor no puede eliminar ──
  BEGIN
    PERFORM pg_temp.como('instructor@test.com');
    PERFORM public.remove_class_b_schedule(ARRAY[e1]);
    EXECUTE 'RESET ROLE';
    v_fails := v_fails || 'AC8 el instructor pudo eliminar; ';
  EXCEPTION WHEN insufficient_privilege THEN v_log := v_log || 'AC8-instr=42501; ';
  END;
  EXECUTE 'RESET ROLE';

  -- ── AC8: la secretaria de otra sede no toca nada ──
  PERFORM pg_temp.como('secretaria2@test.com');
  SELECT count(*) INTO n FROM public.remove_class_b_schedule(ARRAY[e1]);
  EXECUTE 'RESET ROLE';
  IF n <> 0 OR (SELECT status FROM public.class_b_sessions WHERE id = s1) <> 'scheduled' THEN
    v_fails := v_fails || 'AC8 la secretaria de otra sede eliminó; ';
  END IF;

  -- ── AC1: eliminar = clases canceladas + registro + vínculo + sello, en una transacción ──
  PERFORM pg_temp.como('secretaria@test.com');
  SELECT * INTO v_rem FROM public.remove_class_b_schedule(ARRAY[e1]);
  EXECUTE 'RESET ROLE';
  v_log := v_log || 'AC1=' || coalesce(v_rem.cancelled_count::text, 'null') || '; ';
  IF v_rem.cancelled_count IS DISTINCT FROM 2 THEN
    v_fails := v_fails || 'AC1 canceló ' || coalesce(v_rem.cancelled_count::text, 'null') || '; ';
  END IF;
  IF v_rem.first_scheduled_at IS DISTINCT FROM pg_temp.dia(800) THEN
    v_fails := v_fails || 'AC1 primera fecha incorrecta; ';
  END IF;
  IF NOT (v_instr_user = ANY (v_rem.instructor_user_ids)) OR v_rem.student_user_id IS NULL THEN
    v_fails := v_fails || 'AC1 no devolvió destinatarios; ';
  END IF;
  v_removal := v_rem.removal_id;
  IF NOT EXISTS (SELECT 1 FROM public.class_b_schedule_removals
                 WHERE id = v_removal AND enrollment_id = e1 AND removed_by = v_sec
                   AND previous_penalty_applied_at IS NULL AND reactivated_at IS NULL) THEN
    v_fails := v_fails || 'AC1 registro de eliminación incompleto; ';
  END IF;
  SELECT count(*) INTO n FROM public.class_b_sessions
  WHERE id IN (s1, s2) AND status = 'cancelled' AND cancelled_at IS NOT NULL
    AND schedule_removal_id = v_removal;
  IF n <> 2 THEN v_fails := v_fails || 'AC1 solo ' || n || ' clases ligadas; '; END IF;
  IF (SELECT schedule_removal_id FROM public.class_b_sessions WHERE id = s_auto) IS NOT NULL THEN
    v_fails := v_fails || 'AC1 ligó una cancelada ajena; ';
  END IF;
  IF (SELECT absence_penalty_applied_at FROM public.enrollments WHERE id = e1) IS NULL THEN
    v_fails := v_fails || 'AC1 sin sello de penalización; ';
  END IF;

  -- ── AC4: sin eliminación ligada → no revive nada ──
  BEGIN
    PERFORM pg_temp.como('secretaria@test.com');
    PERFORM public.reactivate_class_b_schedule(e2);
    EXECUTE 'RESET ROLE';
    v_fails := v_fails || 'AC4 reactivó sin eliminación; ';
  EXCEPTION WHEN raise_exception THEN v_log := v_log || 'AC4=' || SQLERRM || '; ';
  END;
  EXECUTE 'RESET ROLE';
  IF (SELECT status FROM public.class_b_sessions WHERE id = s_e2) <> 'cancelled' THEN
    v_fails := v_fails || 'AC4 revivió una cancelada sin vínculo; ';
  END IF;

  -- ── AC8: el instructor no puede reactivar ──
  BEGIN
    PERFORM pg_temp.como('instructor@test.com');
    PERFORM public.reactivate_class_b_schedule(e1);
    EXECUTE 'RESET ROLE';
    v_fails := v_fails || 'AC8 el instructor pudo reactivar; ';
  EXCEPTION WHEN insufficient_privilege THEN v_log := v_log || 'AC8-react=42501; ';
  END;
  EXECUTE 'RESET ROLE';

  -- ── AC-E2 (preparación): una de las clases ligadas ya pasó ──
  v_past := pg_temp.dia(-5);
  UPDATE public.class_b_sessions SET scheduled_at = v_past WHERE id = s2;

  -- ── AC2 + AC3: revive solo lo ligado y futuro; el sello vuelve a su valor anterior ──
  PERFORM pg_temp.como('secretaria@test.com');
  SELECT * INTO v_rea FROM public.reactivate_class_b_schedule(e1);
  EXECUTE 'RESET ROLE';
  v_log := v_log || 'AC2=' || coalesce(v_rea.reactivated_count::text, 'null') || '; ';
  IF v_rea.reactivated_count IS DISTINCT FROM 1 THEN
    v_fails := v_fails || 'AC2 reactivó ' || coalesce(v_rea.reactivated_count::text, 'null') || '; ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_b_sessions
                 WHERE id = s1 AND status = 'scheduled' AND cancelled_at IS NULL
                   AND schedule_removal_id IS NULL) THEN
    v_fails := v_fails || 'AC2 la clase 1 no volvió; ';
  END IF;
  IF (SELECT status FROM public.class_b_sessions WHERE id = s2) <> 'cancelled' THEN
    v_fails := v_fails || 'AC-E2 revivió una clase pasada; ';
  END IF;
  IF (SELECT status FROM public.class_b_sessions WHERE id = s_auto) <> 'cancelled' THEN
    v_fails := v_fails || 'AC2 revivió la cancelada por la penalización automática; ';
  END IF;
  IF (SELECT absence_penalty_applied_at FROM public.enrollments WHERE id = e1) IS NOT NULL THEN
    v_fails := v_fails || 'AC3 el sello no volvió a null; ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_b_schedule_removals
                 WHERE id = v_removal AND reactivated_at IS NOT NULL AND reactivated_by = v_sec) THEN
    v_fails := v_fails || 'AC3 la eliminación no quedó marcada como reactivada; ';
  END IF;
  IF v_rea.previous_penalty_applied_at IS NOT NULL THEN
    v_fails := v_fails || 'AC3 devolvió un sello anterior no nulo; ';
  END IF;

  -- ── AC-E4: un segundo "Reactivar" se rechaza ──
  BEGIN
    PERFORM pg_temp.como('secretaria@test.com');
    PERFORM public.reactivate_class_b_schedule(e1);
    EXECUTE 'RESET ROLE';
    v_fails := v_fails || 'AC-E4 reactivó dos veces; ';
  EXCEPTION WHEN raise_exception THEN v_log := v_log || 'AC-E4=' || SQLERRM || '; ';
  END;
  EXECUTE 'RESET ROLE';

  -- ── AC-E3 + AC-E1: eliminar (A) → reagendar → eliminar (B) → reactivar solo B ──
  e3 := pg_temp.enr(v_tpl);
  UPDATE public.enrollments SET absence_penalty_applied_at = NULL WHERE id = e3;
  t1 := pg_temp.ses(e3, 1, pg_temp.dia(820), 'scheduled', v_instr, v_veh);
  PERFORM pg_temp.como('secretaria@test.com');
  PERFORM public.remove_class_b_schedule(ARRAY[e3]);                       -- A
  EXECUTE 'RESET ROLE';
  v_stamp_a := (SELECT absence_penalty_applied_at FROM public.enrollments WHERE id = e3);

  v_items := jsonb_build_array(
    jsonb_build_object('session_id', t1, 'scheduled_at', pg_temp.dia(830), 'vehicle_id', v_veh));
  PERFORM pg_temp.como('admin@test.com');
  PERFORM public.reschedule_class_b_sessions(e3, v_instr, v_items, 'otro', 'Prueba 0058-b');
  EXECUTE 'RESET ROLE';
  IF (SELECT schedule_removal_id FROM public.class_b_sessions WHERE id = t1) IS NOT NULL THEN
    v_fails := v_fails || 'AC-E3 reagendar no soltó el vínculo; ';
  END IF;

  t3 := pg_temp.ses(e3, 3, pg_temp.dia(831), 'scheduled', v_instr, v_veh);
  PERFORM pg_temp.como('secretaria@test.com');
  SELECT * INTO v_rem FROM public.remove_class_b_schedule(ARRAY[e3]);      -- B
  EXECUTE 'RESET ROLE';
  IF v_rem.cancelled_count IS DISTINCT FROM 2 THEN
    v_fails := v_fails || 'AC-E1 B canceló ' || coalesce(v_rem.cancelled_count::text, 'null') || '; ';
  END IF;

  PERFORM pg_temp.como('secretaria@test.com');
  SELECT * INTO v_rea FROM public.reactivate_class_b_schedule(e3);
  EXECUTE 'RESET ROLE';
  IF v_rea.reactivated_count IS DISTINCT FROM 2 THEN
    v_fails := v_fails || 'AC-E1 reactivó ' || coalesce(v_rea.reactivated_count::text, 'null') || '; ';
  END IF;
  IF (SELECT absence_penalty_applied_at FROM public.enrollments WHERE id = e3) IS DISTINCT FROM v_stamp_a THEN
    v_fails := v_fails || 'AC-E1 el sello no volvió al de la eliminación A; ';
  END IF;
  BEGIN
    PERFORM pg_temp.como('secretaria@test.com');
    PERFORM public.reactivate_class_b_schedule(e3);
    EXECUTE 'RESET ROLE';
    v_fails := v_fails || 'AC-E1 un segundo reactivar revivió la eliminación A; ';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  IF v_fails = '' THEN
    RAISE EXCEPTION 'RESULTADO spec-0058-b: TODO OK — %', v_log;
  ELSE
    RAISE EXCEPTION 'RESULTADO spec-0058-b: FALLA — % | %', v_fails, v_log;
  END IF;
END
$test$;
