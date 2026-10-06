-- ============================================================================
-- Prueba de BD — fix-186-b (ASG-i-026): reglas del Triple Match y vista de disponibilidad
-- ============================================================================
-- Checklist: specs/testing-piloto/026-agenda-triple-match.md (casos O02, O03, L01–L03 y
-- sospechas S2, S3, S4, S6, S19, S20).
--
-- Cada caso corre en un sub-bloque que SIEMPRE aborta (SQLSTATE ZZ001): no deja filas ni cambios.
-- Correr como postgres. El resultado queda en la tabla temporal r026 (último SELECT).
--
--   tipo = 'regla'  → debe cumplirse hoy (regresión). Si falla: ❌ real.
--   tipo = 'sospecha' → se informa 'BUG' u 'ok'; no hace fallar la prueba.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r026;
CREATE TEMP TABLE r026 (caso text, tipo text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  -- Datos del piloto (sede 1: instructores 222/223 con vehículos 1/2; sede 2: instructor 230 con vehículo 3)
  c_i1 CONSTANT int := 222;  c_v1 CONSTANT int := 1;
  c_i2 CONSTANT int := 223;  c_v2 CONSTANT int := 2;
  c_i3 CONSTANT int := 230;  c_v3 CONSTANT int := 3;   -- sede 2
  v_e1 int; v_e2 int;                                  -- 2 matrículas B activas de sede 1, alumnos distintos
  v_t  timestamptz;                                    -- horario libre de prueba (≈ 3 semanas)
  v_err text; v_n bigint; v_txt text;
  v_sec2 uuid;                                         -- secretaria sede 2
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Correr como postgres (current_user = %)', current_user;
  END IF;

  SELECT e.id INTO v_e1 FROM enrollments e JOIN courses c ON c.id = e.course_id
   WHERE c.type = 'class_b' AND e.status = 'active' AND e.branch_id = 1 ORDER BY e.id LIMIT 1;
  SELECT e.id INTO v_e2 FROM enrollments e JOIN courses c ON c.id = e.course_id
   WHERE c.type = 'class_b' AND e.status = 'active' AND e.branch_id = 1
     AND e.student_id <> (SELECT student_id FROM enrollments WHERE id = v_e1) ORDER BY e.id LIMIT 1;
  SELECT supabase_uid INTO v_sec2 FROM users WHERE email = 'secretaria2@test.com';

  -- Primer lunes a 08:30 (Chile) a partir de 21 días, sin clases de los 3 instructores/vehículos ni de los 2 alumnos
  SELECT t INTO v_t FROM (
    SELECT ((d::date + time '08:30') AT TIME ZONE 'America/Santiago') AS t
      FROM generate_series(current_date + 21, current_date + 60, interval '1 day') d
     WHERE extract(isodow FROM d) = 1) c
   WHERE NOT EXISTS (
     SELECT 1 FROM class_b_sessions cb JOIN enrollments e ON e.id = cb.enrollment_id
      WHERE cb.status <> 'cancelled'
        AND (cb.instructor_id IN (c_i1, c_i2, c_i3) OR cb.vehicle_id IN (c_v1, c_v2, c_v3)
             OR e.student_id IN (SELECT student_id FROM enrollments WHERE id IN (v_e1, v_e2)))
        AND cb.scheduled_at < c.t + interval '45 min' AND cb.scheduled_at + interval '45 min' > c.t)
   ORDER BY t LIMIT 1;

  IF v_e1 IS NULL OR v_e2 IS NULL OR v_t IS NULL OR v_sec2 IS NULL THEN
    RAISE EXCEPTION 'Faltan datos de prueba (e1=%, e2=%, t=%, sec2=%)', v_e1, v_e2, v_t, v_sec2;
  END IF;

  -- ── O02 / L01: mismo instructor, mismo horario → rechazado ───────────────
  v_err := NULL;
  BEGIN
    INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e1, c_i1, c_v1, v_t, 'scheduled');
    BEGIN
      INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e2, c_i1, c_v2, v_t, 'scheduled');
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r026 VALUES ('O02/L01 instructor ocupado', 'regla', 'rechazado',
    coalesce(v_err, 'se guardó'), CASE WHEN v_err LIKE '%instructor ya tiene%' THEN 'ok' ELSE 'FALLA' END);

  -- ── L03: mismo alumno, mismo horario, otro instructor → rechazado (fix-301-m) ──
  v_err := NULL;
  BEGIN
    INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e1, c_i1, c_v1, v_t, 'scheduled');
    BEGIN
      INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e1, c_i2, c_v2, v_t, 'scheduled');
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r026 VALUES ('L03 alumno ocupado', 'regla', 'rechazado',
    coalesce(v_err, 'se guardó'), CASE WHEN v_err LIKE '%alumno ya tiene%' THEN 'ok' ELSE 'FALLA' END);

  -- ── O03a / L02 (S4): otro instructor con el MISMO vehículo, mismo horario ──
  v_err := NULL;
  BEGIN
    INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e1, c_i1, c_v1, v_t, 'scheduled');
    BEGIN
      INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e2, c_i2, c_v1, v_t, 'scheduled');
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r026 VALUES ('O03a/S4 vehículo ocupado (INSERT)', 'sospecha', 'rechazado',
    coalesce(v_err, 'se guardó'), CASE WHEN v_err IS NULL THEN 'BUG' ELSE 'ok' END);

  -- ── O03b (S4): cambiar solo vehicle_id a uno ocupado ─────────────────────
  v_err := NULL;
  BEGIN
    INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e1, c_i1, c_v1, v_t, 'scheduled');
    INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e2, c_i2, c_v2, v_t, 'scheduled');
    BEGIN
      UPDATE class_b_sessions SET vehicle_id = c_v1 WHERE enrollment_id = v_e2 AND scheduled_at = v_t;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r026 VALUES ('O03b/S4 vehículo ocupado (UPDATE vehicle_id)', 'sospecha', 'rechazado',
    coalesce(v_err, 'se guardó'), CASE WHEN v_err IS NULL THEN 'BUG' ELSE 'ok' END);

  -- ── S2: horarios de hoy que ya pasaron se ofrecen como disponibles ───────
  SELECT count(*) INTO v_n FROM v_class_b_schedule_availability
   WHERE slot_status = 'available' AND slot_start < now() AND slot_start >= date_trunc('day', now() AT TIME ZONE 'America/Santiago') AT TIME ZONE 'America/Santiago';
  INSERT INTO r026 VALUES ('S2 horarios pasados de hoy', 'sospecha', '0 disponibles',
    v_n || ' disponibles', CASE WHEN v_n > 0 THEN 'BUG' ELSE 'ok (o día sin bloques pasados)' END);

  -- ── S3: horizonte de la vista ───────────────────────────────────────────
  SELECT (max(slot_start) AT TIME ZONE 'America/Santiago')::date - current_date INTO v_n FROM v_class_b_schedule_availability;
  INSERT INTO r026 VALUES ('S3 horizonte de la vista', 'sospecha', 'límite de la Agenda (2–4 meses)',
    v_n || ' días', CASE WHEN v_n < 60 THEN 'BUG' ELSE 'ok' END);

  -- ── S20: vehículo en mantención sigue ofreciendo horarios ───────────────
  BEGIN
    UPDATE vehicles SET status = 'maintenance' WHERE id = c_v1;
    SELECT count(*) INTO v_n FROM v_class_b_schedule_availability WHERE vehicle_id = c_v1 AND slot_status = 'available';
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r026 VALUES ('S20 vehículo en mantención', 'sospecha', '0 disponibles',
    v_n || ' disponibles', CASE WHEN v_n > 0 THEN 'BUG' ELSE 'ok' END);

  -- ── S19 + S6: instructor y vehículo "ambas sedes" ───────────────────────
  -- Instructor 230 (sede 2) pasa a "ambas sedes" con su vehículo; tiene una clase con un alumno
  -- de la SEDE 1 a la hora v_t. ¿Cuántas filas genera la vista? ¿Qué ve la secretaria de sede 2?
  -- (Lo medido se guarda en variables: lo escrito en r026 dentro del bloque se desharía con él.)
  v_n := NULL; v_txt := NULL; v_err := NULL;
  BEGIN
    UPDATE instructors SET both_branches = true WHERE id = c_i3;
    UPDATE vehicles SET both_branches = true WHERE id = c_v3;
    SELECT count(*) INTO v_n FROM v_class_b_schedule_availability WHERE instructor_id = c_i3 AND slot_start = v_t;

    INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e1, c_i3, c_v3, v_t, 'scheduled');
    SELECT string_agg(DISTINCT slot_status, ',') INTO v_txt FROM v_class_b_schedule_availability WHERE instructor_id = c_i3 AND slot_start = v_t;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec2, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT string_agg(DISTINCT slot_status, ',') INTO v_err FROM v_class_b_schedule_availability WHERE instructor_id = c_i3 AND slot_start = v_t;
    EXECUTE 'RESET ROLE';
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  EXECUTE 'RESET ROLE';
  INSERT INTO r026 VALUES ('S19 filas por horario (ambas sedes)', 'sospecha', '1',
    coalesce(v_n::text, '?'), CASE WHEN v_n > 1 THEN 'BUG' ELSE 'ok' END);
  INSERT INTO r026 VALUES ('S6 control: postgres ve el horario ocupado', 'regla', 'occupied',
    coalesce(v_txt, '(sin fila)'), CASE WHEN v_txt = 'occupied' THEN 'ok' ELSE 'FALLA' END);
  INSERT INTO r026 VALUES ('S6 secretaria sede 2 ve el horario', 'sospecha', 'occupied',
    coalesce(v_err, '(sin fila)'), CASE WHEN v_err LIKE '%available%' THEN 'BUG' ELSE 'ok' END);

  INSERT INTO r026 VALUES ('(horario de prueba)', 'info', '', to_char(v_t AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD HH24:MI') || ' · e1=' || v_e1 || ' e2=' || v_e2, '');
END
$test$;

SELECT * FROM r026;
