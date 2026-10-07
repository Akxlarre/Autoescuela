-- ============================================================================
-- Prueba de BD — fix-196-b: disponibilidad de la Agenda sin RLS fila por fila
-- ============================================================================
-- ACs en specs/fixes/fix-196-b-agenda-disponibilidad-lenta/fix.md (F1–F5).
-- Lo que escribe corre en un sub-bloque que SIEMPRE aborta (ZZ001): no deja cambios.
-- Correr como postgres. Resultado en la tabla temporal r196 (último SELECT); "FALLA" = ❌.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r196;
CREATE TEMP TABLE r196 (caso text, esperado text, obtenido text, resultado text);
GRANT ALL ON pg_temp.r196 TO authenticated;

DO $test$
DECLARE
  v_sec2   uuid;
  v_dif    int;
  v_ms     numeric;
  v_t0     timestamptz;
  v_slot   record;
  v_e1     int;
  v_estado text;
  v_def    text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;
  SELECT supabase_uid INTO v_sec2 FROM public.users WHERE email = 'secretaria2@test.com';

  -- ── F4: privilegios de la función ─────────────────────────────────────────
  INSERT INTO r196 VALUES ('F4 privilegios class_b_slot_occupied', 'anon ✗ · authenticated ✓',
    format('anon %s · authenticated %s',
      has_function_privilege('anon', 'public.class_b_slot_occupied(integer,integer,timestamptz,timestamptz)', 'EXECUTE'),
      has_function_privilege('authenticated', 'public.class_b_slot_occupied(integer,integer,timestamptz,timestamptz)', 'EXECUTE')),
    CASE WHEN NOT has_function_privilege('anon', 'public.class_b_slot_occupied(integer,integer,timestamptz,timestamptz)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.class_b_slot_occupied(integer,integer,timestamptz,timestamptz)', 'EXECUTE')
         THEN 'ok' ELSE 'FALLA' END);

  -- ── F5: sin MATERIALIZED (hotfix-003-i) ───────────────────────────────────
  v_def := pg_get_viewdef('public.v_class_b_schedule_availability'::regclass, true);
  INSERT INTO r196 VALUES ('F5 vista sin MATERIALIZED', 'sin MATERIALIZED',
    CASE WHEN v_def ILIKE '%materialized%' THEN 'con MATERIALIZED' ELSE 'sin MATERIALIZED' END,
    CASE WHEN v_def ILIKE '%materialized%' THEN 'FALLA' ELSE 'ok' END);

  -- ── F1: como superusuario, mismas filas que el NOT EXISTS original (próximos 7 días) ──
  SELECT count(*) INTO v_dif FROM (
    (SELECT instructor_id, vehicle_id, slot_start, slot_status
       FROM public.v_class_b_schedule_availability
      WHERE slot_start >= now() AND slot_start < now() + interval '7 days'
     EXCEPT
     SELECT v.instructor_id, v.vehicle_id, v.slot_start,
            CASE WHEN NOT EXISTS (
              SELECT 1 FROM public.class_b_sessions cb JOIN public.enrollments e ON e.id = cb.enrollment_id
               WHERE (cb.instructor_id = v.instructor_id OR cb.vehicle_id = v.vehicle_id)
                 AND cb.status NOT IN ('cancelled')
                 AND (e.status <> 'draft' OR e.expires_at > now())
                 AND cb.scheduled_at < v.slot_end
                 AND (cb.scheduled_at + (cb.duration_min * INTERVAL '1 minute')) > v.slot_start)
              THEN 'available' ELSE 'occupied' END
       FROM public.v_class_b_schedule_availability v
      WHERE v.slot_start >= now() AND v.slot_start < now() + interval '7 days')
  ) d;
  INSERT INTO r196 VALUES ('F1 mismas filas que el NOT EXISTS original (superusuario)', '0 diferencias',
    v_dif || ' diferencias', CASE WHEN v_dif = 0 THEN 'ok' ELSE 'FALLA' END);

  -- ── F3: tiempo como secretaria de la sede 2, una semana ───────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec2, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_t0 := clock_timestamp();
  PERFORM count(*) FROM public.v_class_b_schedule_availability
    WHERE slot_status = 'available' AND slot_start >= now() AND slot_start < now() + interval '7 days';
  v_ms := extract(epoch FROM clock_timestamp() - v_t0) * 1000;
  RESET ROLE;
  INSERT INTO r196 VALUES ('F3 semana de Agenda como secretaria sede 2', '< 1000 ms',
    round(v_ms) || ' ms', CASE WHEN v_ms < 1000 THEN 'ok' ELSE 'FALLA' END);

  -- ── F2: una clase en la sede 1 bloquea el turno que ve la secretaria de la sede 2 ──
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT instructor_id, vehicle_id, slot_start, slot_end INTO v_slot
      FROM public.v_class_b_schedule_availability
     WHERE slot_status = 'available' AND slot_start > now() + interval '2 days'
     ORDER BY slot_start LIMIT 1;
    RESET ROLE;
    IF v_slot IS NULL THEN RAISE EXCEPTION 'Sin turnos disponibles para la secretaria de la sede 2'; END IF;

    -- Matrícula activa de la sede 1 sin clases en ese horario.
    SELECT e.id INTO v_e1 FROM public.enrollments e
     WHERE e.branch_id = 1 AND e.status = 'active' AND e.license_group = 'class_b'
       AND NOT EXISTS (SELECT 1 FROM public.class_b_sessions c WHERE c.enrollment_id = e.id
                        AND c.status <> 'cancelled'
                        AND c.scheduled_at < v_slot.slot_end
                        AND c.scheduled_at + c.duration_min * interval '1 minute' > v_slot.slot_start)
       AND NOT EXISTS (SELECT 1 FROM public.class_b_sessions c WHERE c.enrollment_id = e.id AND c.class_number = 12)
     ORDER BY e.id LIMIT 1;

    INSERT INTO public.class_b_sessions (enrollment_id, instructor_id, vehicle_id, class_number,
                                         scheduled_at, duration_min, status)
    VALUES (v_e1, v_slot.instructor_id, v_slot.vehicle_id, 12, v_slot.slot_start, 45, 'scheduled');

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT slot_status INTO v_estado FROM public.v_class_b_schedule_availability
     WHERE instructor_id = v_slot.instructor_id AND vehicle_id = v_slot.vehicle_id
       AND slot_start = v_slot.slot_start;
    RESET ROLE;
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN
    NULL; -- deshace la clase de prueba (las variables de PL/pgSQL sobreviven al rollback)
  END;
  INSERT INTO r196 VALUES ('F2 clase de la sede 1 → la secretaria de la sede 2 ve el turno ocupado',
    'occupied', coalesce(v_estado, '(sin fila)'), CASE WHEN v_estado = 'occupied' THEN 'ok' ELSE 'FALLA' END);
END $test$;

SELECT * FROM r196 ORDER BY caso;
