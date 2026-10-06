-- ============================================================================
-- Prueba de BD — fix-187-b: la BD impide el mismo vehículo en dos clases solapadas
-- ============================================================================
-- ACs en specs/fixes/fix-187-b-vehiculo-doble-agendado/fix.md (F1–F5; F6 —concurrencia— no se
-- puede probar en una sola sesión: lo cubre el pg_advisory_xact_lock del trigger).
--
-- Cada caso corre en un sub-bloque que SIEMPRE aborta (SQLSTATE ZZ001): no deja filas ni cambios.
-- Correr como postgres. Resultado en la tabla temporal r187 (último SELECT); "FALLA" = ❌.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r187;
CREATE TEMP TABLE r187 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  c_i1 CONSTANT int := 222;  c_v1 CONSTANT int := 1;   -- sede 1
  c_i2 CONSTANT int := 223;  c_v2 CONSTANT int := 2;   -- sede 1
  c_i3 CONSTANT int := 230;                            -- sede 2
  c_msg CONSTANT text := 'El vehículo ya tiene una clase agendada que se solapa con este horario.';
  v_e1 int; v_e2 int; v_e3 int;                        -- e1, e2: sede 1 · e3: sede 2 (alumnos distintos)
  v_t  timestamptz;
  v_err text;
  v_sec2 uuid;
  v_hist int;                                          -- clase completada con un choque histórico
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Correr como postgres (current_user = %)', current_user;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prevent_vehicle_double_booking') THEN
    RAISE EXCEPTION 'Falta el trigger trg_prevent_vehicle_double_booking (migración fix-187-b)';
  END IF;

  SELECT e.id INTO v_e1 FROM enrollments e JOIN courses c ON c.id = e.course_id
   WHERE c.type = 'class_b' AND e.status = 'active' AND e.branch_id = 1 ORDER BY e.id LIMIT 1;
  SELECT e.id INTO v_e2 FROM enrollments e JOIN courses c ON c.id = e.course_id
   WHERE c.type = 'class_b' AND e.status = 'active' AND e.branch_id = 1
     AND e.student_id <> (SELECT student_id FROM enrollments WHERE id = v_e1) ORDER BY e.id LIMIT 1;
  SELECT e.id INTO v_e3 FROM enrollments e JOIN courses c ON c.id = e.course_id
   WHERE c.type = 'class_b' AND e.status = 'active' AND e.branch_id = 2 ORDER BY e.id LIMIT 1;
  SELECT supabase_uid INTO v_sec2 FROM users WHERE email = 'secretaria2@test.com';

  -- Primer lunes 08:30 (Chile) desde 21 días, libre para los instructores, vehículos y alumnos usados
  SELECT t INTO v_t FROM (
    SELECT ((d::date + time '08:30') AT TIME ZONE 'America/Santiago') AS t
      FROM generate_series(current_date + 21, current_date + 90, interval '1 day') d
     WHERE extract(isodow FROM d) = 1) c
   WHERE NOT EXISTS (
     SELECT 1 FROM class_b_sessions cb JOIN enrollments e ON e.id = cb.enrollment_id
      WHERE cb.status NOT IN ('cancelled', 'no_show')
        AND (cb.instructor_id IN (c_i1, c_i2, c_i3) OR cb.vehicle_id IN (c_v1, c_v2)
             OR e.student_id IN (SELECT student_id FROM enrollments WHERE id IN (v_e1, v_e2, v_e3)))
        AND cb.scheduled_at < c.t + interval '2 hours' AND cb.scheduled_at + interval '45 min' > c.t)
   ORDER BY t LIMIT 1;

  -- Una clase completada que hoy choca (histórico del seed) con otra del mismo vehículo
  SELECT a.id INTO v_hist
    FROM class_b_sessions a JOIN class_b_sessions b ON b.vehicle_id = a.vehicle_id AND b.id <> a.id
   WHERE a.status = 'completed' AND b.status = 'completed'
     AND a.scheduled_at < b.scheduled_at + interval '45 min' AND b.scheduled_at < a.scheduled_at + interval '45 min'
   LIMIT 1;

  IF v_e1 IS NULL OR v_e2 IS NULL OR v_e3 IS NULL OR v_t IS NULL OR v_sec2 IS NULL THEN
    RAISE EXCEPTION 'Faltan datos de prueba (e1=%, e2=%, e3=%, t=%, sec2=%)', v_e1, v_e2, v_e3, v_t, v_sec2;
  END IF;

  -- ── F1: INSERT con el vehículo ocupado ──────────────────────────────────
  v_err := NULL;
  BEGIN
    INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e1, c_i1, c_v1, v_t, 'scheduled');
    BEGIN
      INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e2, c_i2, c_v1, v_t + interval '20 min', 'scheduled');
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r187 VALUES ('F1 INSERT vehículo ocupado (solape parcial)', 'rechazado', coalesce(v_err, 'se guardó'),
    CASE WHEN v_err = c_msg THEN 'ok' ELSE 'FALLA' END);

  -- ── F1 control: horario contiguo (sin solape) → se guarda ────────────────
  v_err := NULL;
  BEGIN
    INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e1, c_i1, c_v1, v_t, 'scheduled');
    BEGIN
      INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e2, c_i2, c_v1, v_t + interval '45 min', 'scheduled');
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r187 VALUES ('F1 control: horario contiguo', 'se guarda', coalesce(v_err, 'se guardó'),
    CASE WHEN v_err IS NULL THEN 'ok' ELSE 'FALLA' END);

  -- ── F2a: UPDATE solo de vehicle_id a uno ocupado ("Iniciar" con cambio de vehículo) ──
  v_err := NULL;
  BEGIN
    INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e1, c_i1, c_v1, v_t, 'scheduled');
    INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e2, c_i2, c_v2, v_t, 'scheduled');
    BEGIN
      UPDATE class_b_sessions SET vehicle_id = c_v1, status = 'in_progress' WHERE enrollment_id = v_e2 AND scheduled_at = v_t;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r187 VALUES ('F2a UPDATE vehicle_id a uno ocupado', 'rechazado', coalesce(v_err, 'se guardó'),
    CASE WHEN v_err = c_msg THEN 'ok' ELSE 'FALLA' END);

  -- ── F2b: UPDATE de scheduled_at hacia un choque ─────────────────────────
  v_err := NULL;
  BEGIN
    INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e1, c_i1, c_v1, v_t, 'scheduled');
    INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e2, c_i2, c_v1, v_t + interval '60 min', 'scheduled');
    BEGIN
      UPDATE class_b_sessions SET scheduled_at = v_t WHERE enrollment_id = v_e2 AND scheduled_at = v_t + interval '60 min';
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r187 VALUES ('F2b UPDATE scheduled_at hacia un choque', 'rechazado', coalesce(v_err, 'se guardó'),
    CASE WHEN v_err = c_msg THEN 'ok' ELSE 'FALLA' END);

  -- ── F2c: reactivar una clase cancelada sobre un choque ──────────────────
  v_err := NULL;
  BEGIN
    INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e2, c_i2, c_v1, v_t, 'cancelled');
    INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e1, c_i1, c_v1, v_t, 'scheduled');
    BEGIN
      UPDATE class_b_sessions SET status = 'scheduled' WHERE enrollment_id = v_e2 AND scheduled_at = v_t;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r187 VALUES ('F2c reactivar cancelada sobre un choque', 'rechazado', coalesce(v_err, 'se guardó'),
    CASE WHEN v_err = c_msg THEN 'ok' ELSE 'FALLA' END);

  -- ── F3: una clase cancelada o no_show no ocupa el vehículo ──────────────
  v_err := NULL;
  BEGIN
    INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e1, c_i1, c_v1, v_t, 'cancelled');
    INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e1, c_i1, c_v1, v_t + interval '50 min', 'no_show');
    BEGIN
      INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e2, c_i2, c_v1, v_t, 'scheduled');
      INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e2, c_i2, c_v1, v_t + interval '50 min', 'scheduled');
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO r187 VALUES ('F3 cancelada / no_show no ocupan', 'se guarda', coalesce(v_err, 'se guardó'),
    CASE WHEN v_err IS NULL THEN 'ok' ELSE 'FALLA' END);

  -- ── F4: una fila con choque histórico se puede seguir actualizando ──────
  v_err := NULL;
  IF v_hist IS NULL THEN
    INSERT INTO r187 VALUES ('F4 choque histórico', 'se actualiza', '(no hay choques históricos)', 'ok (sin datos)');
  ELSE
    BEGIN
      BEGIN
        UPDATE class_b_sessions SET status = 'in_progress' WHERE id = v_hist;
        UPDATE class_b_sessions SET status = 'completed', notes = coalesce(notes, '') WHERE id = v_hist;
      EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
      RAISE SQLSTATE 'ZZ001';
    EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
    INSERT INTO r187 VALUES ('F4 fila con choque histórico cambia de estado', 'se actualiza', coalesce(v_err, 'se actualizó'),
      CASE WHEN v_err IS NULL THEN 'ok' ELSE 'FALLA' END);
  END IF;

  -- ── F5: secretaria de sede 2 no puede usar un vehículo ocupado en la sede 1 ──
  v_err := NULL;
  BEGIN
    INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e1, c_i1, c_v1, v_t, 'scheduled');
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec2, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
      INSERT INTO class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e3, c_i3, c_v1, v_t, 'scheduled');
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    EXECUTE 'RESET ROLE';
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  EXECUTE 'RESET ROLE';
  INSERT INTO r187 VALUES ('F5 secretaria sede 2 vs clase de sede 1', 'rechazado', coalesce(v_err, 'se guardó'),
    CASE WHEN v_err = c_msg THEN 'ok' ELSE 'FALLA' END);

  -- ── DG-063: disparado con search_path vacío (como desde el cron nocturno) ──
  -- Se usa un UPDATE solo de vehicle_id: con un INSERT, trg_prevent_student_double_booking (fix-301,
  -- sin search_path propio) corre antes y falla por su cuenta — hallazgo aparte, ver fix.md.
  v_err := NULL;
  BEGIN
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e1, c_i1, c_v1, v_t, 'scheduled');
    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, scheduled_at, status) VALUES (v_e2, c_i2, c_v2, v_t, 'scheduled');
    PERFORM set_config('search_path', '', true);
    BEGIN
      UPDATE public.class_b_sessions SET vehicle_id = c_v1 WHERE enrollment_id = v_e2 AND scheduled_at = v_t;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
    RAISE SQLSTATE 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL; END;
  INSERT INTO pg_temp.r187 VALUES ('DG-063 con search_path vacío', 'rechazado (mensaje del vehículo)', coalesce(v_err, 'se guardó'),
    CASE WHEN v_err = c_msg THEN 'ok' ELSE 'FALLA' END);
END
$test$;

SELECT * FROM r187;
