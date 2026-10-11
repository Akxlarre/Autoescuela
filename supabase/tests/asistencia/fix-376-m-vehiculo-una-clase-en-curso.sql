-- ============================================================================
-- Prueba de BD — fix-376-m: un vehículo no puede estar en dos clases en curso
-- ============================================================================
-- ACs en specs/fixes/fix-376-m-vehiculo-en-dos-clases-en-curso/fix.md (AC1, AC2).
-- Crea sus propias sesiones dentro de la transacción y termina SIEMPRE con RAISE EXCEPTION:
-- no deja cambios. Correr como postgres, después de aplicar 20261011140000_fix376_….
-- ============================================================================

DO $test$
DECLARE
  v_base record;
  v_veh_a int; v_veh_b int;
  v_inst_a int; v_inst_b int; v_inst_c int;
  v_busy int; v_new int; v_free int;
  v_fails text := '';
  v_log text := '';
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT cs.enrollment_id INTO v_base
  FROM public.class_b_sessions cs JOIN public.enrollments e ON e.id = cs.enrollment_id
  WHERE e.status = 'active' ORDER BY cs.id DESC LIMIT 1;

  -- Dos vehículos y tres instructores SIN clases en curso (para aislar el chequeo de vehículo).
  SELECT v.id INTO v_veh_a FROM public.vehicles v
   WHERE NOT EXISTS (SELECT 1 FROM public.class_b_sessions s WHERE s.vehicle_id = v.id AND s.status = 'in_progress')
   ORDER BY v.id LIMIT 1;
  SELECT v.id INTO v_veh_b FROM public.vehicles v
   WHERE v.id <> v_veh_a
     AND NOT EXISTS (SELECT 1 FROM public.class_b_sessions s WHERE s.vehicle_id = v.id AND s.status = 'in_progress')
   ORDER BY v.id LIMIT 1;
  SELECT i.id INTO v_inst_a FROM public.instructors i
   WHERE NOT EXISTS (SELECT 1 FROM public.class_b_sessions s WHERE s.instructor_id = i.id AND s.status = 'in_progress')
   ORDER BY i.id LIMIT 1;
  SELECT i.id INTO v_inst_b FROM public.instructors i
   WHERE i.id <> v_inst_a
     AND NOT EXISTS (SELECT 1 FROM public.class_b_sessions s WHERE s.instructor_id = i.id AND s.status = 'in_progress')
   ORDER BY i.id LIMIT 1;
  SELECT i.id INTO v_inst_c FROM public.instructors i
   WHERE i.id NOT IN (v_inst_a, v_inst_b)
     AND NOT EXISTS (SELECT 1 FROM public.class_b_sessions s WHERE s.instructor_id = i.id AND s.status = 'in_progress')
   ORDER BY i.id LIMIT 1;

  -- Clase "colgada": ayer 03:15 Chile, instructor A, vehículo A, en curso.
  INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
  VALUES (v_base.enrollment_id, v_inst_a, v_veh_a, 12,
          public.chile_day_start(public.chile_today() - 1) + interval '3 hours 15 minutes', 'scheduled')
  RETURNING id INTO v_busy;
  UPDATE public.class_b_sessions SET status = 'in_progress' WHERE id = v_busy;

  -- Clase nueva de otro instructor (B) con el mismo vehículo A.
  INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
  VALUES (v_base.enrollment_id, v_inst_b, v_veh_a, 11,
          public.chile_day_start(public.chile_today() - 400) + interval '3 hours 15 minutes', 'scheduled')
  RETURNING id INTO v_new;

  -- AC1: iniciar con vehículo A → rechazado con fecha/hora de la clase colgada
  BEGIN
    UPDATE public.class_b_sessions SET status = 'in_progress' WHERE id = v_new;
    v_fails := v_fails || 'AC1 vehículo ocupado aceptado; ';
  EXCEPTION WHEN raise_exception THEN
    v_log := v_log || 'AC1=' || SQLERRM || '; ';
    IF SQLERRM NOT LIKE 'El vehículo está en una clase en curso (%, 03:15); finalízala antes.' THEN
      v_fails := v_fails || 'AC1 mensaje inesperado; ';
    END IF;
  END;

  -- AC1 (cambio de vehículo en el mismo UPDATE): inicia con B pero cambia a A → rechazado
  BEGIN
    UPDATE public.class_b_sessions SET vehicle_id = v_veh_b WHERE id = v_new;
    UPDATE public.class_b_sessions SET status = 'in_progress', vehicle_id = v_veh_a WHERE id = v_new;
    v_fails := v_fails || 'AC1 cambio a vehículo ocupado aceptado; ';
  EXCEPTION WHEN raise_exception THEN v_log := v_log || 'AC1 cambio=rechazado; ';
  END;

  -- AC2: con vehículo libre (B) e instructor libre (C) → OK
  INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, status)
  VALUES (v_base.enrollment_id, v_inst_c, v_veh_b, 10,
          public.chile_day_start(public.chile_today() - 401) + interval '3 hours 15 minutes', 'scheduled')
  RETURNING id INTO v_free;
  BEGIN
    UPDATE public.class_b_sessions SET status = 'in_progress' WHERE id = v_free;
    v_log := v_log || 'AC2 libre=ok; ';
  EXCEPTION WHEN raise_exception THEN v_fails := v_fails || 'AC2 libre rechazado: ' || SQLERRM || '; ';
  END;

  -- AC2: el chequeo del instructor sigue (instructor A ya tiene la colgada)
  BEGIN
    UPDATE public.class_b_sessions SET status = 'scheduled' WHERE id = v_free;
    UPDATE public.class_b_sessions SET instructor_id = v_inst_a WHERE id = v_free;
    UPDATE public.class_b_sessions SET status = 'in_progress' WHERE id = v_free;
    v_fails := v_fails || 'AC2 instructor ocupado aceptado; ';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'El instructor ya tiene una clase en curso%' THEN
      v_log := v_log || 'AC2 instructor=rechazado; ';
    ELSE
      v_fails := v_fails || 'AC2 instructor: ' || SQLERRM || '; ';
    END IF;
  END;

  IF v_fails = '' THEN
    RAISE EXCEPTION 'RESULTADO fix-376-m: TODO OK — %', v_log;
  ELSE
    RAISE EXCEPTION 'RESULTADO fix-376-m: FALLA — % | %', v_fails, v_log;
  END IF;
END
$test$;
