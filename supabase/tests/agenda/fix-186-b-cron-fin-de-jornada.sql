-- ============================================================================
-- Prueba de BD — fix-186-b (ASG-i-026): cron de fin de jornada (casos M01–M09)
-- ============================================================================
-- Checklist: specs/testing-piloto/026-agenda-triple-match.md, sección M.
--
-- Llama a public.mark_end_of_day_class_b_absences() (lo que corre pg_cron a las 21:00 Chile) en vez
-- de esperar a la noche. Usa una matrícula B activa de la sede 1 SIN clases y le crea clases en
-- horarios fuera de la grilla (03:07 / 05:07 Chile) para no chocar con clases reales.
--
-- Cada caso corre en un sub-bloque que SIEMPRE aborta (SQLSTATE ZZ001): no deja filas ni cambios.
-- La función del cron recorre TODAS las clases agendadas de hoy o antes; dentro del sub-bloque eso
-- también se deshace.
-- Correr como postgres. Resultado en la tabla temporal r026m (último SELECT).
--
--   tipo = 'regla'    → debe cumplirse hoy (regresión). Si falla: ❌ real.
--   tipo = 'anotar'   → se informa lo que pasa; no hace fallar la prueba.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r026m;
CREATE TEMP TABLE r026m (caso text, tipo text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_enr int; v_student int;
  v_ayer timestamptz;      -- 03:07 Chile de ayer: fuera de la grilla (08:30–20:45)
  v_c1 int; v_c2 int; v_c3 int; v_c4 int;
  v_s1 text; v_s2 text; v_s3 text; v_s4 text; v_att text; v_pen timestamptz;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT e.id, e.student_id INTO v_enr, v_student
    FROM public.enrollments e JOIN public.courses c ON c.id = e.course_id
   WHERE c.type = 'class_b' AND e.status = 'active' AND e.branch_id = 1
     AND e.absence_penalty_applied_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.class_b_sessions cb WHERE cb.enrollment_id = e.id)
   ORDER BY e.id LIMIT 1;
  IF v_enr IS NULL THEN RAISE EXCEPTION 'Falta una matrícula B activa de la sede 1 sin clases'; END IF;

  v_ayer := public.chile_day_start(public.chile_today() - 1) + interval '3 hours 7 minutes';

  -- ── M01 / M02 / M04 / M05: qué toca y qué no toca el cron ───────────────
  BEGIN
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_enr, 222, 1, 1, v_ayer, 'scheduled') RETURNING id INTO v_c1;
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status, km_start, start_time)
    VALUES (v_enr, 222, 1, 2, v_ayer + interval '2 hours', 'in_progress', 1000, '05:07:00') RETURNING id INTO v_c2;
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status, km_start, km_end, completed_at)
    VALUES (v_enr, 222, 1, 3, v_ayer - interval '1 day', 'completed', 1, 1, now()) RETURNING id INTO v_c3;
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_enr, 222, 1, 4, v_ayer + interval '2 days', 'scheduled') RETURNING id INTO v_c4;

    PERFORM public.mark_end_of_day_class_b_absences();

    SELECT status INTO v_s1 FROM public.class_b_sessions WHERE id = v_c1;
    SELECT status INTO v_s2 FROM public.class_b_sessions WHERE id = v_c2;
    SELECT status INTO v_s3 FROM public.class_b_sessions WHERE id = v_c3;
    SELECT status INTO v_s4 FROM public.class_b_sessions WHERE id = v_c4;
    SELECT status INTO v_att FROM public.class_b_practice_attendance
     WHERE class_b_session_id = v_c1 AND archived_at IS NULL;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r026m VALUES
    ('M01 clase de ayer sin iniciar', 'regla', 'no_show / absent', v_s1 || ' / ' || coalesce(v_att, '—'),
      CASE WHEN v_s1 = 'no_show' AND v_att = 'absent' THEN 'ok' ELSE 'FALLA' END),
    ('M02 clase en progreso sin cerrar', 'regla', 'in_progress', v_s2,
      CASE WHEN v_s2 = 'in_progress' THEN 'ok' ELSE 'FALLA' END),
    ('M04 clase completada', 'regla', 'completed', v_s3,
      CASE WHEN v_s3 = 'completed' THEN 'ok' ELSE 'FALLA' END),
    ('M05 clase de pasado mañana', 'regla', 'scheduled', v_s4,
      CASE WHEN v_s4 = 'scheduled' THEN 'ok' ELSE 'FALLA' END);

  -- ── M03 con la configuración de hoy (cancelación automática apagada, spec 0048-b) ──
  v_s3 := NULL;
  BEGIN
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_enr, 222, 1, 1, v_ayer, 'scheduled'), (v_enr, 222, 1, 2, v_ayer + interval '2 hours', 'scheduled');
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_enr, 222, 1, 3, now() + interval '400 days', 'scheduled') RETURNING id INTO v_c3;
    UPDATE public.branch_absence_penalty_config SET auto_cancel_enabled = false WHERE branch_id = 1;
    PERFORM public.mark_end_of_day_class_b_absences();
    SELECT status INTO v_s3 FROM public.class_b_sessions WHERE id = v_c3;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r026m VALUES ('M03 2 faltas seguidas, cancelación apagada', 'regla', 'scheduled', v_s3,
    CASE WHEN v_s3 = 'scheduled' THEN 'ok' ELSE 'FALLA' END);

  -- ── M03 con la cancelación automática encendida → cancela las futuras ──
  v_s3 := NULL; v_pen := NULL;
  BEGIN
    UPDATE public.branch_absence_penalty_config SET auto_cancel_enabled = true WHERE branch_id = 1;
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_enr, 222, 1, 1, v_ayer, 'scheduled'), (v_enr, 222, 1, 2, v_ayer + interval '2 hours', 'scheduled');
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_enr, 222, 1, 3, now() + interval '400 days', 'scheduled') RETURNING id INTO v_c3;
    PERFORM public.mark_end_of_day_class_b_absences();
    SELECT status INTO v_s3 FROM public.class_b_sessions WHERE id = v_c3;
    SELECT absence_penalty_applied_at INTO v_pen FROM public.enrollments WHERE id = v_enr;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r026m VALUES ('M03 2 faltas seguidas, cancelación encendida', 'regla',
    'cancelled / penalización marcada', v_s3 || ' / ' || CASE WHEN v_pen IS NULL THEN 'sin marca' ELSE 'marcada' END,
    CASE WHEN v_s3 = 'cancelled' AND v_pen IS NOT NULL THEN 'ok' ELSE 'FALLA' END);

  -- ── M06: una sola falta (encendida) → no cancela ─────────────────────────
  v_s3 := NULL;
  BEGIN
    UPDATE public.branch_absence_penalty_config SET auto_cancel_enabled = true WHERE branch_id = 1;
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_enr, 222, 1, 1, v_ayer, 'scheduled');
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_enr, 222, 1, 2, now() + interval '400 days', 'scheduled') RETURNING id INTO v_c3;
    PERFORM public.mark_end_of_day_class_b_absences();
    SELECT status INTO v_s3 FROM public.class_b_sessions WHERE id = v_c3;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r026m VALUES ('M06 una sola falta, cancelación encendida', 'regla', 'scheduled', v_s3,
    CASE WHEN v_s3 = 'scheduled' THEN 'ok' ELSE 'FALLA' END);

  -- ── M07: falta justificada antes del cron + otra falta (encendida) → no cancela ──
  v_s3 := NULL;
  BEGIN
    UPDATE public.branch_absence_penalty_config SET auto_cancel_enabled = true WHERE branch_id = 1;
    -- Clase 1: la secretaria la marcó ausente y la justificó en el día (fix-377-m: queda no_show + excused).
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_enr, 222, 1, 1, v_ayer, 'no_show') RETURNING id INTO v_c1;
    INSERT INTO public.class_b_practice_attendance (class_b_session_id, student_id, status, justification)
    VALUES (v_c1, v_student, 'excused', 'E2E prueba M07');
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_enr, 222, 1, 2, v_ayer + interval '2 hours', 'scheduled');
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_enr, 222, 1, 3, now() + interval '400 days', 'scheduled') RETURNING id INTO v_c3;
    PERFORM public.mark_end_of_day_class_b_absences();
    SELECT status INTO v_s3 FROM public.class_b_sessions WHERE id = v_c3;
    SELECT status INTO v_att FROM public.class_b_practice_attendance
     WHERE class_b_session_id = v_c1 AND archived_at IS NULL;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r026m VALUES ('M07 falta justificada + otra falta, encendida', 'regla',
    'scheduled / excused', v_s3 || ' / ' || coalesce(v_att, '—'),
    CASE WHEN v_s3 = 'scheduled' AND v_att = 'excused' THEN 'ok' ELSE 'FALLA' END);

  -- ── M09: clase agendada en un día que después quedó como feriado ────────
  v_s1 := NULL;
  BEGIN
    INSERT INTO public.holidays (date, name, scope, source)
    VALUES (public.chile_today() - 1, 'E2E feriado de prueba', 'national', 'e2e')
    ON CONFLICT (date) DO NOTHING;
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_enr, 222, 1, 1, v_ayer, 'scheduled') RETURNING id INTO v_c1;
    PERFORM public.mark_end_of_day_class_b_absences();
    SELECT status INTO v_s1 FROM public.class_b_sessions WHERE id = v_c1;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r026m VALUES ('M09 clase en un feriado, nadie la inicia', 'anotar',
    'decisión del owner', v_s1, CASE WHEN v_s1 = 'no_show' THEN 'la marca No asistió' ELSE 'no la toca' END);
END
$test$;

SELECT * FROM r026m;
