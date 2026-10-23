-- ============================================================================
-- Test — spec 0052-b: un feriado no ofrece horarios
-- ============================================================================
-- AC1, AC4, AC5. Marca como feriado el próximo día con bloques (que no sea hoy) DENTRO de un
-- sub-bloque que siempre aborta (SQLSTATE ZZ001): no deja cambios. Lee la vista como postgres y
-- como secretaria. Requiere la migración 20261019120000. Correr como postgres.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r0052;
CREATE TEMP TABLE r0052 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_res   text[] := '{}';
  v_dia   date;
  v_otro  date;
  v_n     bigint;
  v_m     bigint;
  v_uid   uuid;
  v_err   text := 'ok';
  v_esc   text := 'ok';
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  -- Los dos próximos días con bloques, sin contar hoy.
  SELECT d INTO v_dia FROM (
    SELECT DISTINCT (slot_start AT TIME ZONE 'America/Santiago')::date AS d
      FROM public.v_class_b_schedule_availability
     WHERE (slot_start AT TIME ZONE 'America/Santiago')::date > public.chile_today()
  ) x ORDER BY d LIMIT 1;
  SELECT d INTO v_otro FROM (
    SELECT DISTINCT (slot_start AT TIME ZONE 'America/Santiago')::date AS d
      FROM public.v_class_b_schedule_availability
     WHERE (slot_start AT TIME ZONE 'America/Santiago')::date > v_dia
  ) x ORDER BY d LIMIT 1;
  IF v_dia IS NULL OR v_otro IS NULL THEN RAISE EXCEPTION 'La vista no tiene días con bloques'; END IF;
  SELECT supabase_uid INTO v_uid FROM public.users WHERE email = 'secretaria@test.com';

  BEGIN
    DELETE FROM public.holidays WHERE date IN (v_dia, v_otro);
    INSERT INTO public.holidays (date, name, scope, source) VALUES (v_dia, 'Feriado de prueba', 'national', 'test');

    -- AC4
    SELECT count(*) INTO v_n FROM public.v_class_b_schedule_availability
     WHERE (slot_start AT TIME ZONE 'America/Santiago')::date = v_dia;
    v_res := v_res || format('AC4 el feriado no tiene bloques|0|%s', v_n);
    SELECT count(*) INTO v_m FROM public.v_class_b_schedule_availability
     WHERE (slot_start AT TIME ZONE 'America/Santiago')::date = v_otro;
    v_res := v_res || format('AC4 el día siguiente con bloques sigue teniéndolos|true|%s', (v_m > 0)::text);

    -- AC5 + AC1: la secretaria lee la vista (sin bloques el feriado) y no puede escribir feriados.
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      SELECT count(*) INTO v_n FROM public.v_class_b_schedule_availability
       WHERE (slot_start AT TIME ZONE 'America/Santiago')::date = v_dia;
      SELECT count(*) INTO v_m FROM public.holidays WHERE date = v_dia;
      BEGIN
        INSERT INTO public.holidays (date, name, scope, source) VALUES (v_otro, 'x', 'national', 'x');
        v_esc := 'pudo escribir';
      EXCEPTION WHEN OTHERS THEN
        v_esc := 'ok';
      END;
      EXECUTE 'RESET ROLE';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM;
      EXECUTE 'RESET ROLE';
    END;
    v_res := v_res || format('AC5 la secretaria lee la vista|ok|%s', v_err);
    v_res := v_res || format('AC5 y tampoco ve bloques el feriado|0|%s', v_n);
    v_res := v_res || format('AC1 la secretaria lee los feriados|1|%s', v_m);
    v_res := v_res || format('AC1 la secretaria no puede escribir feriados|ok|%s', v_esc);

    RAISE SQLSTATE 'ZZ001';
  EXCEPTION
    WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  INSERT INTO r0052
  SELECT split_part(r, '|', 1), split_part(r, '|', 2), split_part(r, '|', 3),
         CASE WHEN split_part(r, '|', 2) = split_part(r, '|', 3) THEN 'ok' ELSE 'FALLA' END
    FROM unnest(v_res) AS r;

  IF EXISTS (SELECT 1 FROM r0052 WHERE resultado = 'FALLA') THEN
    RAISE EXCEPTION E'0052-b: % caso(s) fallaron:\n%',
      (SELECT count(*) FROM r0052 WHERE resultado = 'FALLA'),
      (SELECT string_agg(format('%s — esperado %s, obtenido %s', caso, esperado, obtenido), E'\n')
         FROM r0052 WHERE resultado = 'FALLA');
  END IF;
END
$test$;

SELECT count(*) AS casos, count(*) FILTER (WHERE resultado = 'ok') AS ok FROM r0052;
