-- ============================================================================
-- fix-072-i — un horario tomado por un borrador vencido se ve ocupado.
-- Arma un borrador vencido y uno vigente con una clase reservada en horarios libres, y revisa que
-- la vista los marque ocupados. Al cancelar la clase, el horario vuelve a quedar libre.
-- Todo corre en un sub-bloque que SIEMPRE aborta (ZZ001): no deja cambios. Correr como postgres.
-- Requiere la migración de fix-072-i aplicada.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r072;
CREATE TEMP TABLE r072 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_res      text[] := '{}';   -- 'caso|esperado|obtenido' (las variables sobreviven al aborto)
  v_stu      int[];
  v_course   int[];
  v_instr    int;
  v_vehicle  int;
  v_slots    timestamptz[];
  d_vencido  int;
  d_vigente  int;
  s_vencido  int;
  v_estado   text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT array_agg(student_id), array_agg(course_id) INTO v_stu, v_course
  FROM (
    SELECT DISTINCT ON (e.student_id) e.student_id, e.course_id
    FROM public.enrollments e
    WHERE e.status = 'active' AND e.branch_id = 1
    ORDER BY e.student_id, e.id DESC
    LIMIT 2
  ) x;
  IF coalesce(array_length(v_stu, 1), 0) < 2 THEN
    RAISE EXCEPTION 'Faltan 2 alumnos con matrícula activa en la sede 1';
  END IF;

  -- Un instructor con dos horarios libres, lejos de hoy para no chocar con clases del alumno.
  SELECT instructor_id, vehicle_id INTO v_instr, v_vehicle
  FROM public.v_class_b_schedule_availability
  WHERE slot_status = 'available' AND slot_start > now() + interval '60 days'
  ORDER BY slot_start LIMIT 1;

  SELECT array_agg(slot_start ORDER BY slot_start) INTO v_slots
  FROM (
    SELECT slot_start FROM public.v_class_b_schedule_availability
    WHERE slot_status = 'available' AND slot_start > now() + interval '60 days'
      AND instructor_id = v_instr AND vehicle_id = v_vehicle
    ORDER BY slot_start LIMIT 2
  ) x;
  IF coalesce(array_length(v_slots, 1), 0) < 2 THEN
    RAISE EXCEPTION 'Faltan 2 horarios libres de un mismo instructor';
  END IF;

  BEGIN
    INSERT INTO public.enrollments (student_id, course_id, branch_id, base_price, discount, total_paid,
      pending_balance, status, expires_at, docs_complete, contract_accepted, certificate_enabled,
      registration_channel)
    VALUES (v_stu[1], v_course[1], 1, 100000, 0, 0, NULL, 'draft', NOW() - interval '1 hour',
            false, false, false, 'in_person')
    RETURNING id INTO d_vencido;

    INSERT INTO public.enrollments (student_id, course_id, branch_id, base_price, discount, total_paid,
      pending_balance, status, expires_at, docs_complete, contract_accepted, certificate_enabled,
      registration_channel)
    VALUES (v_stu[2], v_course[2], 1, 100000, 0, 0, NULL, 'draft', NOW() + interval '10 hours',
            false, false, false, 'in_person')
    RETURNING id INTO d_vigente;

    INSERT INTO public.class_b_sessions (enrollment_id, class_number, instructor_id, vehicle_id,
      scheduled_at, duration_min, status)
    VALUES (d_vencido, 1, v_instr, v_vehicle, v_slots[1], 45, 'reserved')
    RETURNING id INTO s_vencido;

    INSERT INTO public.class_b_sessions (enrollment_id, class_number, instructor_id, vehicle_id,
      scheduled_at, duration_min, status)
    VALUES (d_vigente, 1, v_instr, v_vehicle, v_slots[2], 45, 'reserved');

    SELECT slot_status INTO v_estado FROM public.v_class_b_schedule_availability
    WHERE instructor_id = v_instr AND vehicle_id = v_vehicle AND slot_start = v_slots[1];
    v_res := v_res || format('F1 borrador vencido ocupa el horario|occupied|%s', coalesce(v_estado, '(sin fila)'));

    SELECT slot_status INTO v_estado FROM public.v_class_b_schedule_availability
    WHERE instructor_id = v_instr AND vehicle_id = v_vehicle AND slot_start = v_slots[2];
    v_res := v_res || format('F2 borrador vigente sigue ocupando|occupied|%s', coalesce(v_estado, '(sin fila)'));

    UPDATE public.class_b_sessions SET status = 'cancelled' WHERE id = s_vencido;

    SELECT slot_status INTO v_estado FROM public.v_class_b_schedule_availability
    WHERE instructor_id = v_instr AND vehicle_id = v_vehicle AND slot_start = v_slots[1];
    v_res := v_res || format('F3 clase cancelada libera el horario|available|%s', coalesce(v_estado, '(sin fila)'));

    RAISE SQLSTATE 'ZZ001';   -- deshace todo lo anterior
  EXCEPTION
    WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  INSERT INTO r072
  SELECT split_part(r, '|', 1), split_part(r, '|', 2), split_part(r, '|', 3),
         CASE WHEN split_part(r, '|', 2) = split_part(r, '|', 3) THEN 'ok' ELSE 'FALLA' END
    FROM unnest(v_res) AS r;
END
$test$;

SELECT * FROM r072;
