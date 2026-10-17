-- ============================================================================
-- Test — fix-224-b: un vehículo no operativo no ofrece horarios
-- ============================================================================
-- V1 de specs/fixes/fix-224-b-vehiculo-no-operativo/fix.md. Toma un instructor activo con
-- vehículo asignado que hoy genera turnos y cambia el estado de ese vehículo DENTRO de un
-- sub-bloque que siempre aborta (SQLSTATE ZZ001): no deja cambios.
-- Requiere la migración 20261015120000. Correr como postgres.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r224;
CREATE TEMP TABLE r224 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_res   text[] := '{}';
  v_veh   int;
  v_ini   timestamptz := now();
  v_fin   timestamptz := now() + interval '28 days';
  v_n     bigint;
  v_st    text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT vehicle_id INTO v_veh FROM public.v_class_b_schedule_availability
   WHERE slot_start >= v_ini AND slot_start < v_fin
   GROUP BY vehicle_id ORDER BY count(*) DESC LIMIT 1;
  IF v_veh IS NULL THEN RAISE EXCEPTION 'No hay ningún vehículo con turnos para probar'; END IF;

  -- La función espejo del util de la app.
  FOREACH v_st IN ARRAY ARRAY['maintenance', 'mantenimiento', 'out_of_service', 'blocked', 'MAINTENANCE'] LOOP
    v_res := v_res || format('V1 "%s" no es operativo|false|%s', v_st, public.vehicle_is_operational(v_st)::text);
  END LOOP;
  FOREACH v_st IN ARRAY ARRAY['operational', 'available', 'disponible', 'in_use'] LOOP
    v_res := v_res || format('V1 "%s" es operativo|true|%s', v_st, public.vehicle_is_operational(v_st)::text);
  END LOOP;
  v_res := v_res || format('V1 NULL es operativo|true|%s', public.vehicle_is_operational(NULL)::text);

  BEGIN
    FOREACH v_st IN ARRAY ARRAY['maintenance', 'out_of_service'] LOOP
      UPDATE public.vehicles SET status = v_st WHERE id = v_veh;
      SELECT count(*) INTO v_n FROM public.v_class_b_schedule_availability
       WHERE vehicle_id = v_veh AND slot_start >= v_ini AND slot_start < v_fin;
      v_res := v_res || format('V1 vehículo en "%s" sin turnos|0|%s', v_st, v_n);
    END LOOP;

    UPDATE public.vehicles SET status = 'operational' WHERE id = v_veh;
    SELECT count(*) INTO v_n FROM public.v_class_b_schedule_availability
     WHERE vehicle_id = v_veh AND slot_start >= v_ini AND slot_start < v_fin;
    v_res := v_res || format('V1 de vuelta a operativo, los turnos reaparecen|true|%s', (v_n > 0)::text);

    RAISE SQLSTATE 'ZZ001';
  EXCEPTION
    WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  INSERT INTO r224
  SELECT split_part(r, '|', 1), split_part(r, '|', 2), split_part(r, '|', 3),
         CASE WHEN split_part(r, '|', 2) = split_part(r, '|', 3) THEN 'ok' ELSE 'FALLA' END
    FROM unnest(v_res) AS r;

  IF EXISTS (SELECT 1 FROM r224 WHERE resultado = 'FALLA') THEN
    RAISE EXCEPTION E'fix-224-b: % caso(s) fallaron:\n%',
      (SELECT count(*) FROM r224 WHERE resultado = 'FALLA'),
      (SELECT string_agg(format('%s — esperado %s, obtenido %s', caso, esperado, obtenido), E'\n')
         FROM r224 WHERE resultado = 'FALLA');
  END IF;
END
$test$;

SELECT count(*) AS casos, count(*) FILTER (WHERE resultado = 'ok') AS ok FROM r224;
