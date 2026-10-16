-- ============================================================================
-- Test — fix-228-b: horarios hasta hoy + 4 meses y sin bloques ya empezados
-- ============================================================================
-- H1–H3 de specs/fixes/fix-228-b-horarios-plazo-y-pasados/fix.md. Solo lee. Requiere la
-- migración 20261016150000. Correr como postgres.
--
-- H1 tiene sentido de día: antes de las 08:30 (Chile) no hay bloques de hoy que ya hayan
-- empezado, así que el caso pasa igual con o sin la migración. Desde las 08:30 lo distingue.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r228;
CREATE TEMP TABLE r228 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_res   text[] := '{}';
  v_hoy   date := public.chile_today();
  v_max   date;
  v_uid   uuid;
  v_n     bigint;
  v_dup   bigint;
  v_err   text := 'ok';
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  -- H1
  SELECT count(*) INTO v_n FROM public.v_class_b_schedule_availability WHERE slot_start <= now();
  v_res := v_res || format('H1 ningún bloque ya empezado|0|%s', v_n);

  -- H2: el último día con bloques está en la última semana del plazo de 4 meses.
  SELECT max((slot_start AT TIME ZONE 'America/Santiago')::date) INTO v_max
    FROM public.v_class_b_schedule_availability;
  v_res := v_res || format('H2 cubre hasta hoy + 4 meses|true|%s',
    (v_max > (v_hoy + interval '4 months')::date - 7 AND v_max <= (v_hoy + interval '4 months')::date)::text);

  -- H3: con sesión de secretaria se lee y no hay repetidos.
  SELECT supabase_uid INTO v_uid FROM public.users WHERE email = 'secretaria@test.com';
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO v_dup FROM (
      SELECT 1 FROM public.v_class_b_schedule_availability
       WHERE slot_start < now() + interval '14 days'
       GROUP BY instructor_id, vehicle_id, slot_start HAVING count(*) > 1) d;
    EXECUTE 'RESET ROLE';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    EXECUTE 'RESET ROLE';
  END;
  v_res := v_res || format('H3 la secretaria lee la vista|ok|%s', v_err);
  v_res := v_res || format('H3 sin bloques repetidos|0|%s', v_dup);

  INSERT INTO r228
  SELECT split_part(r, '|', 1), split_part(r, '|', 2), split_part(r, '|', 3),
         CASE WHEN split_part(r, '|', 2) = split_part(r, '|', 3) THEN 'ok' ELSE 'FALLA' END
    FROM unnest(v_res) AS r;

  IF EXISTS (SELECT 1 FROM r228 WHERE resultado = 'FALLA') THEN
    RAISE EXCEPTION E'fix-228-b: % caso(s) fallaron:\n%',
      (SELECT count(*) FROM r228 WHERE resultado = 'FALLA'),
      (SELECT string_agg(format('%s — esperado %s, obtenido %s', caso, esperado, obtenido), E'\n')
         FROM r228 WHERE resultado = 'FALLA');
  END IF;
END
$test$;

SELECT count(*) AS casos, count(*) FILTER (WHERE resultado = 'ok') AS ok FROM r228;
