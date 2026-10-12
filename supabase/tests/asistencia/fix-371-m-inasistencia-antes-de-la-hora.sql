-- ============================================================================
-- Prueba de BD — fix-371-m: una inasistencia solo se registra cuando la hora ya pasó
-- ============================================================================
-- ACs en specs/fixes/fix-371-m-inasistencia-antes-de-la-hora/fix.md (AC1–AC4).
-- Crea sus propias sesiones dentro de la transacción y termina SIEMPRE con RAISE EXCEPTION:
-- no deja cambios. El mensaje trae el resultado ("TODO OK" o los fallos).
-- Correr como postgres, después de aplicar 20261011130000_fix371_….
-- ============================================================================

DO $test$
DECLARE
  v_base record;
  v_future int; v_past int; v_later int;
  v_fails text := '';
  v_log text := '';
  v_status text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  -- Una matrícula activa cualquiera con un instructor y un vehículo de sus clases.
  SELECT cs.enrollment_id, cs.instructor_id, cs.vehicle_id, e.student_id
    INTO v_base
  FROM public.class_b_sessions cs
  JOIN public.enrollments e ON e.id = cs.enrollment_id
  WHERE e.status = 'active'
  ORDER BY cs.id DESC LIMIT 1;

  -- Horas a las 03:15-03:45 de Chile para no chocar con la agenda real.
  INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
  VALUES (v_base.enrollment_id, v_base.instructor_id, v_base.vehicle_id, 12,
          (public.chile_day_start(public.chile_today() + 400) + interval '3 hours 15 minutes'), 'scheduled')
  RETURNING id INTO v_future;
  INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
  VALUES (v_base.enrollment_id, v_base.instructor_id, v_base.vehicle_id, 11,
          (public.chile_day_start(public.chile_today() - 400) + interval '3 hours 15 minutes'), 'scheduled')
  RETURNING id INTO v_past;

  -- AC1: sesión futura → no_show rechazado
  BEGIN
    UPDATE public.class_b_sessions SET status = 'no_show' WHERE id = v_future;
    v_fails := v_fails || 'AC1 no_show futura aceptado; ';
  EXCEPTION WHEN raise_exception THEN v_log := v_log || 'AC1 no_show futura=rechazado; ';
  END;

  -- AC1: asistencia absent sobre sesión futura → rechazada
  BEGIN
    INSERT INTO public.class_b_practice_attendance (class_b_session_id, student_id, status)
    VALUES (v_future, v_base.student_id, 'absent');
    v_fails := v_fails || 'AC1 absent futura aceptado; ';
  EXCEPTION WHEN raise_exception THEN v_log := v_log || 'AC1 absent futura=rechazado; ';
  END;

  -- AC1: INSERT directo de una sesión futura en no_show → rechazado
  BEGIN
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_base.enrollment_id, v_base.instructor_id, v_base.vehicle_id, 10,
            (public.chile_day_start(public.chile_today() + 401) + interval '3 hours 45 minutes'), 'no_show');
    v_fails := v_fails || 'AC1 insert no_show futura aceptado; ';
  EXCEPTION WHEN raise_exception THEN v_log := v_log || 'AC1 insert no_show futura=rechazado; ';
  END;

  -- AC3: justificar sobre sesión futura → permitido
  DELETE FROM public.class_b_practice_attendance WHERE class_b_session_id = v_future;
  BEGIN
    INSERT INTO public.class_b_practice_attendance (class_b_session_id, student_id, status, justification)
    VALUES (v_future, v_base.student_id, 'excused', 'prueba');
    v_log := v_log || 'AC3 excused futura=ok; ';
    DELETE FROM public.class_b_practice_attendance WHERE class_b_session_id = v_future;
  EXCEPTION WHEN raise_exception THEN v_fails := v_fails || 'AC3 excused rechazado; ';
  END;

  -- AC2: sesión pasada → no_show + absent permitidos
  BEGIN
    UPDATE public.class_b_sessions SET status = 'no_show' WHERE id = v_past;
    INSERT INTO public.class_b_practice_attendance (class_b_session_id, student_id, status)
    VALUES (v_past, v_base.student_id, 'absent');
    v_log := v_log || 'AC2 pasada=ok; ';
  EXCEPTION WHEN raise_exception THEN v_fails := v_fails || 'AC2 pasada rechazada: ' || SQLERRM || '; ';
  END;

  -- AC4: el cron salta la clase de hoy posterior a ahora y no aborta. Se simula con una clase
  -- de hoy dentro de 1 minuto (si "hoy" alcanza; si no, se omite).
  IF (now() + interval '2 minutes') < public.chile_day_start(public.chile_today() + 1) THEN
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
    VALUES (v_base.enrollment_id, v_base.instructor_id, v_base.vehicle_id, 9,
            date_trunc('minute', now()) + interval '2 minutes', 'scheduled')
    RETURNING id INTO v_later;
    -- El cron recorre TODAS las clases agendadas hasta hoy; se mira solo la nuestra.
    UPDATE public.class_b_sessions SET status = 'cancelled' WHERE id = v_past; -- que no interfiera
    PERFORM public.mark_end_of_day_class_b_absences();
    SELECT status INTO v_status FROM public.class_b_sessions WHERE id = v_later;
    v_log := v_log || format('AC4 cron clase de hoy más tarde=%s; ', v_status);
    IF v_status <> 'scheduled' THEN v_fails := v_fails || 'AC4 cron la marcó; '; END IF;
  ELSE
    v_log := v_log || 'AC4 omitido (fin del día); ';
  END IF;

  IF v_fails = '' THEN
    RAISE EXCEPTION 'RESULTADO fix-371-m: TODO OK — %', v_log;
  ELSE
    RAISE EXCEPTION 'RESULTADO fix-371-m: FALLA — % | %', v_fails, v_log;
  END IF;
END
$test$;
