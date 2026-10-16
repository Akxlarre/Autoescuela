-- ============================================================================
-- Test — fix-222-b: el kilometraje del vehículo lo mantiene la BD
-- ============================================================================
-- F1–F4 de specs/fixes/fix-222-b-kilometraje-vehiculo/fix.md.
-- Usa el vehículo de prueba 36 (ZZ4103) y una clase de la sede 2, todo DENTRO de un sub-bloque que
-- siempre aborta (SQLSTATE ZZ001): no deja cambios. Requiere la migración 20261013120000 aplicada.
-- Correr como postgres.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r222;
CREATE TEMP TABLE r222 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_res  text[] := '{}';
  V      constant int := 36;
  v_ses  int;
  v_sec2 uuid;
  v_rows bigint;
  v_km   int;
  v_last date;
  v_hoy  date := public.chile_today();
  v_m    int;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vehicles WHERE id = V) THEN
    RAISE EXCEPTION 'Falta el vehículo de prueba %', V;
  END IF;
  SELECT cb.id INTO v_ses
    FROM public.class_b_sessions cb
    JOIN public.enrollments e ON e.id = cb.enrollment_id
   WHERE e.branch_id = 2 AND cb.status = 'scheduled'
   ORDER BY cb.id LIMIT 1;
  SELECT supabase_uid INTO v_sec2 FROM public.users WHERE email = 'secretaria2@test.com';
  IF v_ses IS NULL OR v_sec2 IS NULL THEN RAISE EXCEPTION 'Faltan datos de prueba (clase agendada de la sede 2)'; END IF;

  BEGIN
    -- Vehículo "Ambas" de la sede 1, en 1.000 km, usado por una clase de la sede 2.
    UPDATE public.vehicles SET current_km = 1000, last_maintenance = NULL, both_branches = true WHERE id = V;
    UPDATE public.class_b_sessions SET vehicle_id = V, km_start = NULL, km_end = NULL WHERE id = v_ses;

    -- F1: el km final de la clase sube el km del vehículo.
    UPDATE public.class_b_sessions SET km_end = 1500 WHERE id = v_ses;
    SELECT current_km INTO v_km FROM public.vehicles WHERE id = V;
    v_res := v_res || format('F1 km final 1.500 sobre 1.000 → vehículo|1500|%s', v_km);

    -- F2: un km final menor no hace retroceder al vehículo; la clase guarda lo anotado.
    UPDATE public.class_b_sessions SET km_end = 1200 WHERE id = v_ses;
    SELECT current_km INTO v_km FROM public.vehicles WHERE id = V;
    v_res := v_res || format('F2 km final 1.200 sobre 1.500 → vehículo no baja|1500|%s', v_km);
    v_res := v_res || format('F2 la clase conserva el km anotado|1200|%s',
                             (SELECT km_end FROM public.class_b_sessions WHERE id = v_ses));

    -- F1 (S2): la secretaria de la sede 2 no puede editar ese vehículo, pero al finalizar su
    -- clase el km igual se actualiza.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec2, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.vehicles SET current_km = 9999 WHERE id = V;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_res := v_res || format('S2 la secretaria NO puede editar el vehículo "Ambas" directamente|0|%s', v_rows);
    UPDATE public.class_b_sessions SET km_end = 1800 WHERE id = v_ses;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    v_res := v_res || format('S2 la secretaria registra el km final de su clase|1|%s', v_rows);
    SELECT current_km INTO v_km FROM public.vehicles WHERE id = V;
    v_res := v_res || format('F1/S2 y el km del vehículo "Ambas" queda actualizado|1800|%s', v_km);

    -- F3 + F4: mantenimiento completado hoy con km mayor.
    INSERT INTO public.maintenance_records (vehicle_id, description, status, km_at_time, completed_date)
    VALUES (V, 'test fix-222-b', 'completed', 2500, v_hoy) RETURNING id INTO v_m;
    SELECT current_km, last_maintenance INTO v_km, v_last FROM public.vehicles WHERE id = V;
    v_res := v_res || format('F3 mantenimiento con 2.500 km → vehículo|2500|%s', v_km);
    v_res := v_res || format('F4 su fecha queda como última mantención|%s|%s', v_hoy, v_last);

    -- F3: km menor y fecha anterior no cambian nada.
    INSERT INTO public.maintenance_records (vehicle_id, description, status, km_at_time, completed_date)
    VALUES (V, 'test fix-222-b antiguo', 'completed', 2000, v_hoy - 30);
    SELECT current_km, last_maintenance INTO v_km, v_last FROM public.vehicles WHERE id = V;
    v_res := v_res || format('F3 mantenimiento con km menor → vehículo no baja|2500|%s', v_km);
    v_res := v_res || format('F4 una fecha anterior no reemplaza la última mantención|%s|%s', v_hoy, v_last);

    -- Un mantenimiento que no está completado no mueve nada.
    INSERT INTO public.maintenance_records (vehicle_id, description, status, km_at_time, scheduled_date)
    VALUES (V, 'test fix-222-b programado', 'scheduled', 9000, v_hoy);
    SELECT current_km INTO v_km FROM public.vehicles WHERE id = V;
    v_res := v_res || format('F3 mantenimiento sin completar no toca el km|2500|%s', v_km);

    -- F4: una fecha futura no pasa a ser la última mantención.
    INSERT INTO public.maintenance_records (vehicle_id, description, status, completed_date)
    VALUES (V, 'test fix-222-b futuro', 'completed', v_hoy + 10);
    SELECT last_maintenance INTO v_last FROM public.vehicles WHERE id = V;
    v_res := v_res || format('F4 una fecha futura no cuenta como última mantención|%s|%s', v_hoy, v_last);

    -- F3: editar un mantenimiento subiendo su km también actualiza.
    UPDATE public.maintenance_records SET km_at_time = 3000 WHERE id = v_m;
    SELECT current_km INTO v_km FROM public.vehicles WHERE id = V;
    v_res := v_res || format('F3 editar el km del mantenimiento a 3.000 → vehículo|3000|%s', v_km);

    -- F5: el admin (aquí postgres) sigue pudiendo corregir el km a mano, también hacia abajo.
    UPDATE public.vehicles SET current_km = 2900 WHERE id = V;
    SELECT current_km INTO v_km FROM public.vehicles WHERE id = V;
    v_res := v_res || format('F5 corrección manual del km hacia abajo|2900|%s', v_km);

    RAISE SQLSTATE 'ZZ001';
  EXCEPTION
    WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  INSERT INTO r222
  SELECT split_part(r, '|', 1), split_part(r, '|', 2), split_part(r, '|', 3),
         CASE WHEN split_part(r, '|', 2) = split_part(r, '|', 3) THEN 'ok' ELSE 'FALLA' END
    FROM unnest(v_res) AS r;

  IF EXISTS (SELECT 1 FROM r222 WHERE resultado = 'FALLA') THEN
    RAISE EXCEPTION E'fix-222-b: % caso(s) fallaron:\n%',
      (SELECT count(*) FROM r222 WHERE resultado = 'FALLA'),
      (SELECT string_agg(format('%s — esperado %s, obtenido %s', caso, esperado, obtenido), E'\n')
         FROM r222 WHERE resultado = 'FALLA');
  END IF;
END
$test$;

SELECT count(*) AS casos, count(*) FILTER (WHERE resultado = 'ok') AS ok FROM r222;
