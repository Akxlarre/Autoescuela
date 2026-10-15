-- ============================================================================
-- Prueba de BD — fix-384-m: un par ya penalizado no vuelve a contar; el cron solo toca
-- matrículas activas
-- ============================================================================
-- ACs en specs/fixes/fix-384-m-par-penalizado-no-vuelve-a-contar/fix.md (AC1–AC5).
-- Crea sus propias matrículas y clases, prende la cancelación automática de la sede SOLO dentro de
-- la transacción y termina SIEMPRE con RAISE EXCEPTION: no deja cambios. Correr como postgres,
-- después de aplicar 20261012130000_fix384_….
--
-- Las faltas "nuevas" llevan recorded_at = now() + N minutos: dentro de una transacción now() es
-- fijo, y la marca de la penalización también es now().
-- ============================================================================

CREATE FUNCTION pg_temp.enr(p_template int, p_status text DEFAULT 'active') RETURNS int
LANGUAGE sql AS $$
  INSERT INTO public.enrollments (number, student_id, course_id, branch_id, base_price, discount,
    total_paid, pending_balance, payment_status, status, docs_complete, contract_accepted,
    registration_channel, license_group)
  SELECT 'T384-' || floor(random() * 1e9)::text, student_id, course_id, branch_id, base_price, 0,
    base_price, 0, 'paid', p_status, true, true, 'in_person', 'class_b'
  FROM public.enrollments WHERE id = p_template
  RETURNING id $$;

-- Un día distinto por clase (tope de 2 por día del alumno) y 05:10 Chile (sin choques de agenda).
CREATE FUNCTION pg_temp.dia(p_offset int) RETURNS timestamptz LANGUAGE sql AS $$
  SELECT public.chile_day_start(public.chile_today() + p_offset) + interval '5 hours 10 minutes' $$;

CREATE FUNCTION pg_temp.ses(p_enr int, p_n int, p_at timestamptz, p_status text,
  p_instr int, p_veh int) RETURNS int
LANGUAGE sql AS $$
  INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number,
    scheduled_at, status)
  VALUES (p_enr, p_instr, p_veh, p_n, p_at, p_status) RETURNING id $$;

CREATE FUNCTION pg_temp.falta(p_enr int, p_n int, p_rec timestamptz, p_status text DEFAULT 'absent')
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.class_b_sessions SET status = 'no_show'
  WHERE enrollment_id = p_enr AND class_number = p_n;
  INSERT INTO public.class_b_practice_attendance (class_b_session_id, student_id, status, recorded_at)
  SELECT s.id, e.student_id, p_status, p_rec
  FROM public.class_b_sessions s JOIN public.enrollments e ON e.id = s.enrollment_id
  WHERE s.enrollment_id = p_enr AND s.class_number = p_n;
END $$;

CREATE FUNCTION pg_temp.agendadas(p_enr int) RETURNS int LANGUAGE sql AS $$
  SELECT count(*)::int FROM public.class_b_sessions
  WHERE enrollment_id = p_enr AND status = 'scheduled' $$;

DO $test$
DECLARE
  v_tpl int; v_instr int; v_veh int;
  e1 int; e2 int; e3 int; e4 int; e5 int; ec1 int; ec2 int;
  n int; r int; s int;
  v_fails text := '';
  v_log text := '';
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  -- Plantilla: una matrícula Clase B activa de la sede 1 (de ahí salen alumno, curso y precio).
  SELECT e.id INTO v_tpl FROM public.enrollments e
  WHERE e.status = 'active' AND e.branch_id = 1 AND e.license_group = 'class_b'
  ORDER BY e.id DESC LIMIT 1;
  SELECT cs.instructor_id, cs.vehicle_id INTO v_instr, v_veh
  FROM public.class_b_sessions cs JOIN public.enrollments e ON e.id = cs.enrollment_id
  WHERE e.branch_id = 1 ORDER BY cs.id DESC LIMIT 1;

  -- El trigger de spec 0048-b fija enabled_since = now() al prender la regla; el segundo UPDATE
  -- (ya prendida) lo corre 30 días atrás para que cuenten las faltas sembradas "hace una hora".
  UPDATE public.branch_absence_penalty_config SET auto_cancel_enabled = true WHERE branch_id = 1;
  UPDATE public.branch_absence_penalty_config
  SET enabled_since = now() - interval '30 days'
  WHERE branch_id = 1;

  -- ── AC5 / F01: faltas 3-4 → cancela 5-11 y deja la marca ──
  e1 := pg_temp.enr(v_tpl);
  FOR n IN 3..4 LOOP s := pg_temp.ses(e1, n, pg_temp.dia(-500 - n), 'scheduled', v_instr, v_veh); END LOOP;
  FOR n IN 5..11 LOOP s := pg_temp.ses(e1, n, pg_temp.dia(500 + n), 'scheduled', v_instr, v_veh); END LOOP;
  PERFORM pg_temp.falta(e1, 3, now() - interval '2 hours');
  PERFORM pg_temp.falta(e1, 4, now() - interval '1 hour');
  r := public.apply_class_b_absence_penalty(e1);
  v_log := v_log || 'F01=' || r || '; ';
  IF r <> 7 THEN v_fails := v_fails || 'AC5 F01 esperaba 7, dio ' || r || '; '; END IF;
  IF (SELECT absence_penalty_applied_at FROM public.enrollments WHERE id = e1) IS NULL THEN
    v_fails := v_fails || 'AC5 sin marca de penalización; ';
  END IF;

  -- ── AC1: reagendar solo las canceladas (5-7 ya ocurridas, 8-11 futuras) y volver a llamar ──
  UPDATE public.class_b_sessions SET status = 'scheduled', cancelled_at = NULL,
         scheduled_at = CASE WHEN class_number <= 7 THEN pg_temp.dia(-400 - class_number)
                             ELSE pg_temp.dia(600 + class_number) END
  WHERE enrollment_id = e1 AND class_number BETWEEN 5 AND 11;
  r := public.apply_class_b_absence_penalty(e1);
  v_log := v_log || 'AC1=' || r || '; ';
  IF r <> 0 THEN v_fails := v_fails || 'AC1 el par penalizado volvió a cancelar ' || r || '; '; END IF;

  -- ── AC3: falta nueva en la 5 (seguida a la 4 vieja) → no penaliza ──
  PERFORM pg_temp.falta(e1, 5, now() + interval '1 minute');
  r := public.apply_class_b_absence_penalty(e1);
  v_log := v_log || 'AC3=' || r || '; ';
  IF r <> 0 THEN v_fails := v_fails || 'AC3 4 vieja + 5 nueva penalizó ' || r || '; '; END IF;

  -- ── AC2: dos faltas nuevas seguidas (6 y 7) → vuelve a penalizar 8-11 ──
  PERFORM pg_temp.falta(e1, 6, now() + interval '2 minutes');
  PERFORM pg_temp.falta(e1, 7, now() + interval '3 minutes');
  r := public.apply_class_b_absence_penalty(e1);
  v_log := v_log || 'AC2=' || r || '; ';
  IF r <> 4 THEN v_fails := v_fails || 'AC2 esperaba 4, dio ' || r || '; '; END IF;

  -- ── AC5 / F02: faltas 2 y 5, no seguidas → 0 ──
  e2 := pg_temp.enr(v_tpl);
  FOR n IN 2..5 LOOP s := pg_temp.ses(e2, n, pg_temp.dia(-300 - n), 'scheduled', v_instr, v_veh); END LOOP;
  s := pg_temp.ses(e2, 6, pg_temp.dia(700), 'scheduled', v_instr, v_veh);
  PERFORM pg_temp.falta(e2, 2, now() - interval '2 hours');
  PERFORM pg_temp.falta(e2, 5, now() - interval '1 hour');
  r := public.apply_class_b_absence_penalty(e2);
  IF r <> 0 THEN v_fails := v_fails || 'AC5 F02 dio ' || r || '; '; END IF;

  -- ── AC5 / F03: 3 justificada + 4 falta → 0 ──
  e3 := pg_temp.enr(v_tpl);
  FOR n IN 3..4 LOOP s := pg_temp.ses(e3, n, pg_temp.dia(-200 - n), 'scheduled', v_instr, v_veh); END LOOP;
  s := pg_temp.ses(e3, 5, pg_temp.dia(710), 'scheduled', v_instr, v_veh);
  PERFORM pg_temp.falta(e3, 3, now() - interval '2 hours', 'excused');
  PERFORM pg_temp.falta(e3, 4, now() - interval '1 hour');
  r := public.apply_class_b_absence_penalty(e3);
  IF r <> 0 THEN v_fails := v_fails || 'AC5 F03 dio ' || r || '; '; END IF;

  -- ── AC5 / enabled_since: par registrado antes de prender la regla → 0 ──
  e4 := pg_temp.enr(v_tpl);
  FOR n IN 3..4 LOOP s := pg_temp.ses(e4, n, pg_temp.dia(-100 - n), 'scheduled', v_instr, v_veh); END LOOP;
  s := pg_temp.ses(e4, 5, pg_temp.dia(720), 'scheduled', v_instr, v_veh);
  PERFORM pg_temp.falta(e4, 3, now() - interval '40 days');
  PERFORM pg_temp.falta(e4, 4, now() - interval '39 days');
  r := public.apply_class_b_absence_penalty(e4);
  IF r <> 0 THEN v_fails := v_fails || 'AC5 since dio ' || r || '; '; END IF;

  -- ── Cron: AC5 / I01 (activa) y AC4 (retirada) ──
  ec1 := pg_temp.enr(v_tpl);
  s := pg_temp.ses(ec1, 3, pg_temp.dia(-50), 'scheduled', v_instr, v_veh);
  PERFORM pg_temp.falta(ec1, 3, now() - interval '1 hour');
  s := pg_temp.ses(ec1, 4, pg_temp.dia(-1), 'scheduled', v_instr, v_veh);
  FOR n IN 5..6 LOOP s := pg_temp.ses(ec1, n, pg_temp.dia(730 + n), 'scheduled', v_instr, v_veh); END LOOP;
  ec2 := pg_temp.enr(v_tpl, 'withdrawn');
  s := pg_temp.ses(ec2, 1, pg_temp.dia(-2), 'scheduled', v_instr, v_veh);

  PERFORM public.mark_end_of_day_class_b_absences();

  IF (SELECT status FROM public.class_b_sessions WHERE enrollment_id = ec1 AND class_number = 4) <> 'no_show' THEN
    v_fails := v_fails || 'AC5 I01 no marcó la clase de ayer; ';
  END IF;
  IF pg_temp.agendadas(ec1) <> 0 THEN
    v_fails := v_fails || 'AC5 I01 no penalizó; ';
  END IF;
  IF (SELECT status FROM public.class_b_sessions WHERE enrollment_id = ec2) <> 'scheduled' THEN
    v_fails := v_fails || 'AC4 el cron marcó una matrícula retirada; ';
  END IF;
  v_log := v_log || 'cron ok; ';

  IF v_fails = '' THEN
    RAISE EXCEPTION 'RESULTADO fix-384-m: TODO OK — %', v_log;
  ELSE
    RAISE EXCEPTION 'RESULTADO fix-384-m: FALLA — % | %', v_fails, v_log;
  END IF;
END
$test$;
