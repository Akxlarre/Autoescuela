-- ============================================================================
-- Test — fix-227-b: un instructor "Ambas sedes" no duplica sus horarios
-- ============================================================================
-- D1–D4 de specs/fixes/fix-227-b-horarios-ambas-sin-duplicados/fix.md. Marca un instructor de la
-- sede 1 con asignación activa y su vehículo como "Ambas" DENTRO de un sub-bloque que siempre
-- aborta (SQLSTATE ZZ001): no deja cambios. Lee la vista como postgres y como la secretaria de la
-- sede 2 (regla de fix-226-b). Requiere la migración 20261016140000. Correr como postgres.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r227;
CREATE TEMP TABLE r227 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_res    text[] := '{}';
  v_i      int;
  v_v      int;
  v_otro   int;
  v_antes  bigint;
  v_dup    bigint;
  v_n      bigint;
  v_sec2   uuid;
  v_err    text := 'ok';
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT va.instructor_id, va.vehicle_id INTO v_i, v_v
    FROM public.vehicle_assignments va
    JOIN public.instructors i ON i.id = va.instructor_id
    JOIN public.users u ON u.id = i.user_id
   WHERE va.end_date IS NULL AND i.active AND u.branch_id = 1
   ORDER BY va.instructor_id LIMIT 1;
  SELECT va.instructor_id INTO v_otro
    FROM public.vehicle_assignments va
    JOIN public.instructors i ON i.id = va.instructor_id
   WHERE va.end_date IS NULL AND i.active AND va.instructor_id <> v_i
   ORDER BY va.instructor_id LIMIT 1;
  SELECT supabase_uid INTO v_sec2 FROM public.users WHERE email = 'secretaria2@test.com';
  IF v_i IS NULL OR v_otro IS NULL OR v_sec2 IS NULL THEN
    RAISE EXCEPTION 'Faltan datos de prueba (instructores con vehículo, secretaria2)';
  END IF;

  -- D3: un instructor de una sola sede, antes del cambio de datos.
  SELECT count(*) INTO v_antes FROM public.v_class_b_schedule_availability
   WHERE instructor_id = v_otro AND slot_start >= now() AND slot_start < now() + interval '7 days';

  BEGIN
    UPDATE public.instructors SET both_branches = true WHERE id = v_i;
    UPDATE public.vehicles SET both_branches = true WHERE id = v_v;

    -- D1
    SELECT count(*) INTO v_dup FROM (
      SELECT slot_start FROM public.v_class_b_schedule_availability
       WHERE instructor_id = v_i AND slot_start >= now() AND slot_start < now() + interval '7 days'
       GROUP BY instructor_id, vehicle_id, slot_start HAVING count(*) > 1) d;
    v_res := v_res || format('D1 instructor "Ambas" sin bloques repetidos|0|%s', v_dup);

    -- D2: sigue habiendo bloques (de las dos sedes) y con estado válido.
    SELECT count(*) INTO v_n FROM public.v_class_b_schedule_availability
     WHERE instructor_id = v_i AND slot_start >= now() AND slot_start < now() + interval '7 days'
       AND slot_status IN ('available', 'occupied');
    v_res := v_res || format('D2 el instructor "Ambas" sigue con horarios|true|%s', (v_n > 0)::text);

    -- D3
    SELECT count(*) INTO v_n FROM public.v_class_b_schedule_availability
     WHERE instructor_id = v_otro AND slot_start >= now() AND slot_start < now() + interval '7 days';
    v_res := v_res || format('D3 instructor de una sede: mismas filas|%s|%s', v_antes, v_n);

    -- D4: la secretaria de la sede 2 lee la vista y tampoco ve repetidos.
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec2, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      SELECT count(*) INTO v_dup FROM (
        SELECT slot_start FROM public.v_class_b_schedule_availability
         WHERE instructor_id = v_i AND slot_start >= now() AND slot_start < now() + interval '7 days'
         GROUP BY instructor_id, vehicle_id, slot_start HAVING count(*) > 1) d;
      EXECUTE 'RESET ROLE';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM;
      EXECUTE 'RESET ROLE';
    END;
    v_res := v_res || format('D4 la secretaria 2 lee la vista|ok|%s', v_err);
    v_res := v_res || format('D4 y sin bloques repetidos|0|%s', v_dup);

    RAISE SQLSTATE 'ZZ001';
  EXCEPTION
    WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  INSERT INTO r227
  SELECT split_part(r, '|', 1), split_part(r, '|', 2), split_part(r, '|', 3),
         CASE WHEN split_part(r, '|', 2) = split_part(r, '|', 3) THEN 'ok' ELSE 'FALLA' END
    FROM unnest(v_res) AS r;

  IF EXISTS (SELECT 1 FROM r227 WHERE resultado = 'FALLA') THEN
    RAISE EXCEPTION E'fix-227-b: % caso(s) fallaron:\n%',
      (SELECT count(*) FROM r227 WHERE resultado = 'FALLA'),
      (SELECT string_agg(format('%s — esperado %s, obtenido %s', caso, esperado, obtenido), E'\n')
         FROM r227 WHERE resultado = 'FALLA');
  END IF;
END
$test$;

SELECT count(*) AS casos, count(*) FILTER (WHERE resultado = 'ok') AS ok FROM r227;
