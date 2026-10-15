-- ============================================================================
-- Prueba de BD — fix-383-m: el reagendamiento masivo es todo o nada
-- ============================================================================
-- ACs en specs/fixes/fix-383-m-reagendar-todo-o-nada/fix.md (AC1–AC4).
-- Crea sus propias matrículas y clases, llama a la RPC como admin@test.com e instructor@test.com y
-- termina SIEMPRE con RAISE EXCEPTION: no deja cambios. Correr como postgres, después de aplicar
-- 20261012140000_fix383_….
-- ============================================================================

CREATE FUNCTION pg_temp.enr(p_template int) RETURNS int
LANGUAGE sql AS $$
  INSERT INTO public.enrollments (number, student_id, course_id, branch_id, base_price, discount,
    total_paid, pending_balance, payment_status, status, docs_complete, contract_accepted,
    registration_channel, license_group)
  SELECT 'T383-' || floor(random() * 1e9)::text, student_id, course_id, branch_id, base_price, 0,
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
  v_tpl int; v_instr int; v_veh int; v_admin int;
  e1 int; e2 int; s3 int; s4 int; s5 int; s_otra int; s_bloq int;
  r int; n int;
  v_items jsonb;
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
  SELECT id INTO v_admin FROM public.users WHERE email = 'admin@test.com';

  -- Matrícula penalizada: 3 y 4 faltas (con asistencia), 5 cancelada.
  e1 := pg_temp.enr(v_tpl);
  s3 := pg_temp.ses(e1, 3, pg_temp.dia(-600), 'scheduled', v_instr, v_veh);
  s4 := pg_temp.ses(e1, 4, pg_temp.dia(-599), 'scheduled', v_instr, v_veh);
  UPDATE public.class_b_sessions SET status = 'no_show' WHERE id IN (s3, s4);
  INSERT INTO public.class_b_practice_attendance (class_b_session_id, student_id, status)
  SELECT id, (SELECT student_id FROM public.enrollments WHERE id = e1), 'absent'
  FROM public.class_b_sessions WHERE id IN (s3, s4);
  s5 := pg_temp.ses(e1, 5, pg_temp.dia(900), 'cancelled', v_instr, v_veh);

  -- Otra matrícula: una clase ajena y una que ocupa el horario del instructor (choque).
  e2 := pg_temp.enr(v_tpl);
  s_otra := pg_temp.ses(e2, 1, pg_temp.dia(950), 'scheduled', v_instr, v_veh);
  s_bloq := pg_temp.ses(e2, 2, pg_temp.dia(911), 'scheduled', v_instr, v_veh);

  -- ── AC1: el 2º horario choca → no se mueve nada ni se escribe historial ──
  v_items := jsonb_build_array(
    jsonb_build_object('session_id', s3, 'scheduled_at', pg_temp.dia(910), 'vehicle_id', v_veh),
    jsonb_build_object('session_id', s4, 'scheduled_at', pg_temp.dia(911), 'vehicle_id', v_veh),
    jsonb_build_object('session_id', s5, 'scheduled_at', pg_temp.dia(912), 'vehicle_id', v_veh));
  BEGIN
    PERFORM pg_temp.como('admin@test.com');
    r := public.reschedule_class_b_sessions(e1, v_instr, v_items, 'medica');
    EXECUTE 'RESET ROLE';
    v_fails := v_fails || 'AC1 aceptó un horario que choca; ';
  EXCEPTION WHEN OTHERS THEN
    v_log := v_log || 'AC1=' || SQLERRM || '; ';
  END;
  EXECUTE 'RESET ROLE';
  IF (SELECT status FROM public.class_b_sessions WHERE id = s3) <> 'no_show'
     OR (SELECT scheduled_at FROM public.class_b_sessions WHERE id = s3) <> pg_temp.dia(-600) THEN
    v_fails := v_fails || 'AC1 la clase 3 quedó movida; ';
  END IF;
  IF EXISTS (SELECT 1 FROM public.class_b_reschedule_history WHERE enrollment_id = e1) THEN
    v_fails := v_fails || 'AC1 quedó historial; ';
  END IF;

  -- ── AC3: una clase de otra matrícula → rechazada ──
  -- (los ítems se arman antes de cambiar de rol: authenticated no puede llamar a pg_temp)
  v_items := jsonb_build_array(
    jsonb_build_object('session_id', s_otra, 'scheduled_at', pg_temp.dia(920), 'vehicle_id', v_veh));
  BEGIN
    PERFORM pg_temp.como('admin@test.com');
    r := public.reschedule_class_b_sessions(e1, v_instr, v_items, 'medica');
    EXECUTE 'RESET ROLE';
    v_fails := v_fails || 'AC3 aceptó una clase ajena; ';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Una de las clases no pertenece%' THEN v_fails := v_fails || 'AC3 ' || SQLERRM || '; '; END IF;
  END;
  EXECUTE 'RESET ROLE';

  -- ── AC4: un instructor no puede llamarla ──
  v_items := jsonb_build_array(
    jsonb_build_object('session_id', s3, 'scheduled_at', pg_temp.dia(940), 'vehicle_id', v_veh));
  BEGIN
    PERFORM pg_temp.como('instructor@test.com');
    r := public.reschedule_class_b_sessions(e1, v_instr, v_items, 'medica');
    EXECUTE 'RESET ROLE';
    v_fails := v_fails || 'AC4 el instructor pudo reagendar; ';
  EXCEPTION WHEN insufficient_privilege THEN v_log := v_log || 'AC4=42501; ';
  END;
  EXECUTE 'RESET ROLE';

  -- ── AC2: sin choques → las 3 reagendadas, asistencia archivada, historial completo ──
  v_items := jsonb_build_array(
    jsonb_build_object('session_id', s3, 'scheduled_at', pg_temp.dia(930), 'vehicle_id', v_veh),
    jsonb_build_object('session_id', s4, 'scheduled_at', pg_temp.dia(931), 'vehicle_id', v_veh),
    jsonb_build_object('session_id', s5, 'scheduled_at', pg_temp.dia(932), 'vehicle_id', v_veh));
  PERFORM pg_temp.como('admin@test.com');
  r := public.reschedule_class_b_sessions(e1, v_instr, v_items, 'otro', 'Viaje del alumno');
  EXECUTE 'RESET ROLE';
  v_log := v_log || 'AC2=' || r || '; ';
  IF r <> 3 THEN v_fails := v_fails || 'AC2 devolvió ' || r || '; '; END IF;
  SELECT count(*) INTO n FROM public.class_b_sessions
  WHERE id IN (s3, s4, s5) AND status = 'scheduled' AND cancelled_at IS NULL;
  IF n <> 3 THEN v_fails := v_fails || 'AC2 solo ' || n || ' quedaron agendadas; '; END IF;
  IF EXISTS (SELECT 1 FROM public.class_b_practice_attendance
             WHERE class_b_session_id IN (s3, s4) AND archived_at IS NULL) THEN
    v_fails := v_fails || 'AC2 asistencia sin archivar; ';
  END IF;
  SELECT count(*) INTO n FROM public.class_b_reschedule_history
  WHERE enrollment_id = e1 AND reason = 'otro' AND reason_other = 'Viaje del alumno'
    AND registered_by = v_admin AND new_instructor_id = v_instr AND old_instructor_id = v_instr;
  IF n <> 3 THEN v_fails := v_fails || 'AC2 historial con ' || n || ' filas completas; '; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_b_reschedule_history
                 WHERE class_session_id = s3 AND old_scheduled_at = pg_temp.dia(-600)
                   AND new_scheduled_at = pg_temp.dia(930)) THEN
    v_fails := v_fails || 'AC2 historial sin fechas anterior/nueva; ';
  END IF;

  IF v_fails = '' THEN
    RAISE EXCEPTION 'RESULTADO fix-383-m: TODO OK — %', v_log;
  ELSE
    RAISE EXCEPTION 'RESULTADO fix-383-m: FALLA — % | %', v_fails, v_log;
  END IF;
END
$test$;
