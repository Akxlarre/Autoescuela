-- ============================================================================
-- Test SQL — spec 0024-m: día de negocio en hora de Chile
-- ============================================================================
-- Qué verifica (ver specs/specs/0024-m-fechas-de-negocio-en-hora-de-chile/spec.md):
--   AC9   ningún objeto vigente del esquema public deriva un día con la zona de la sesión
--         (CURRENT_DATE, now()::date, LOCALTIME/LOCALTIMESTAMP)
--   AC10  no existe ninguna columna `timestamp without time zone` en public
--   AC11  la ventana de cierres de caja de la secretaria se cuenta desde chile_today()
--   AC12  el corte de inasistencias está agendado para caer a las 21:00 hora Chile todo el año
--   y el contrato de chile_today() / chile_date() / chile_day_start() (mismos casos que
--   src/app/core/utils/chile-time.vectors.json).
--
-- Solo lee: no escribe ni modifica nada. Termina con RAISE EXCEPTION si algún caso falla.
-- Correr como postgres (SQL editor de Supabase, o
--   npx supabase db query --linked -f supabase/tests/timezone/0024-m-business-day.sql).
--
-- Excepción declarada: el CHECK students.chk_minimum_age (ver la migración
-- 20261009121000_time_fix_business_day_objects.sql).
-- ============================================================================

DO $test$
DECLARE
  v_fail text[] := '{}';
  v_re   text := '(current_date|(now\(\)|current_timestamp)\s*\)?\s*::\s*date|localtime)';
  v_row  record;
  v_n    int;
BEGIN
  -- ── Contrato de las funciones ─────────────────────────────────────────────
  IF public.chile_today() <> (now() AT TIME ZONE 'America/Santiago')::date THEN
    v_fail := v_fail || 'chile_today() no coincide con el día de America/Santiago';
  END IF;

  FOR v_row IN
    SELECT * FROM (VALUES
      ('2026-10-06T18:00:00Z'::timestamptz, '2026-10-06'::date), -- 15:00 hora Chile, control
      ('2026-10-07T02:30:00Z', '2026-10-06'),                    -- 23:30 en verano
      ('2026-10-07T03:00:00Z', '2026-10-07'),                    -- 00:00
      ('2026-07-01T03:30:00Z', '2026-06-30'),                    -- 23:30 en invierno, fin de mes
      ('2027-01-01T02:30:00Z', '2026-12-31'),                    -- 23:30 del 31 de diciembre
      ('2026-09-06T03:59:59Z', '2026-09-05'),                    -- último instante antes del salto
      ('2026-09-06T04:00:00Z', '2026-09-06')                     -- primer instante del día de 23 horas
    ) AS t(instant, expected)
  LOOP
    IF public.chile_date(v_row.instant) <> v_row.expected THEN
      v_fail := v_fail || format('chile_date(%s) = %s, esperado %s',
        v_row.instant, public.chile_date(v_row.instant), v_row.expected);
    END IF;
  END LOOP;

  FOR v_row IN
    SELECT * FROM (VALUES
      ('2026-10-06'::date, '2026-10-06T03:00:00Z'::timestamptz), -- verano
      ('2026-07-01', '2026-07-01T04:00:00Z'),                    -- invierno
      ('2026-04-05', '2026-04-05T04:00:00Z'),                    -- día siguiente al de 25 horas
      ('2026-09-06', '2026-09-06T04:00:00Z'),                    -- medianoche inexistente
      ('2026-09-07', '2026-09-07T03:00:00Z')
    ) AS t(day, expected)
  LOOP
    IF public.chile_day_start(v_row.day) <> v_row.expected THEN
      v_fail := v_fail || format('chile_day_start(%s) = %s, esperado %s',
        v_row.day, public.chile_day_start(v_row.day), v_row.expected);
    END IF;
    IF public.chile_date(public.chile_day_start(v_row.day)) <> v_row.day
       OR public.chile_date(public.chile_day_start(v_row.day) - interval '1 millisecond') <> v_row.day - 1 THEN
      v_fail := v_fail || format('chile_day_start(%s) no es el primer instante de ese día', v_row.day);
    END IF;
  END LOOP;

  -- ── AC9: ningún objeto vigente usa la zona de la sesión ───────────────────
  FOR v_row IN
    SELECT 'función ' || p.proname AS obj
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosrc ~* v_re
    UNION ALL
    SELECT 'policy ' || tablename || '.' || policyname
      FROM pg_policies
     WHERE schemaname IN ('public', 'storage')
       AND (coalesce(qual, '') ~* v_re OR coalesce(with_check, '') ~* v_re)
    UNION ALL
    SELECT 'vista ' || viewname FROM pg_views
     WHERE schemaname = 'public' AND definition ~* v_re
    UNION ALL
    SELECT 'vista materializada ' || matviewname FROM pg_matviews
     WHERE schemaname = 'public' AND definition ~* v_re
    UNION ALL
    SELECT 'default ' || a.attrelid::regclass::text || '.' || a.attname
      FROM pg_attrdef d
      JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
      JOIN pg_class cl ON cl.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
     WHERE n.nspname = 'public' AND pg_get_expr(d.adbin, d.adrelid) ~* v_re
    UNION ALL
    SELECT 'check ' || c.conrelid::regclass::text || '.' || c.conname
      FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE n.nspname = 'public' AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) ~* v_re
       AND c.conname <> 'chk_minimum_age'   -- excepción declarada
  LOOP
    v_fail := v_fail || ('AC9: usa la zona de la sesión → ' || v_row.obj);
  END LOOP;

  -- ── AC10: sin columnas de fecha y hora sin zona ───────────────────────────
  FOR v_row IN
    SELECT table_name || '.' || column_name AS obj
      FROM information_schema.columns
     WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'
  LOOP
    v_fail := v_fail || ('AC10: columna sin zona → ' || v_row.obj);
  END LOOP;

  -- ── AC11: ventana de cierres de caja desde el hoy de Chile ────────────────
  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'cash_closings'
     AND policyname = 'select_cash_closings' AND cmd = 'SELECT'
     AND qual ~* 'chile_today\(\)' AND qual ~* 'branch_visible' AND qual ~* 'secretary';
  IF v_n <> 1 THEN
    v_fail := v_fail || 'AC11: select_cash_closings no cuenta la ventana desde chile_today()';
  END IF;

  -- ── AC12: corte de inasistencias a las 21:00 hora Chile ───────────────────
  SELECT count(*) INTO v_n
    FROM cron.job
   WHERE jobname = 'mark-end-of-day-class-b-absences'
     AND schedule = '0 0,1 * * *'
     AND command ~* 'run_class_b_absences_cutoff\(\)';
  IF v_n <> 1 THEN
    v_fail := v_fail || 'AC12: el job no corre a las 00:00 y 01:00 UTC vía run_class_b_absences_cutoff()';
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'run_class_b_absences_cutoff'
     AND p.prosrc ~* 'America/Santiago' AND p.prosrc ~* '<>\s*21'
     AND p.prosrc ~* 'mark_end_of_day_class_b_absences\(\)';
  IF v_n <> 1 THEN
    v_fail := v_fail || 'AC12: run_class_b_absences_cutoff() no exige hora Chile = 21';
  END IF;

  -- Las dos corridas diarias caen una (y solo una) a las 21:00 hora Chile, en verano e invierno.
  FOR v_row IN
    SELECT d::date AS day FROM (VALUES ('2026-01-15'), ('2026-07-15'), ('2026-04-05'), ('2026-09-06')) AS t(d)
  LOOP
    SELECT count(*) INTO v_n
      FROM (VALUES (0), (1)) AS h(utc_hour)
     WHERE EXTRACT(HOUR FROM
             ((v_row.day::text || ' ' || h.utc_hour || ':00:00+00')::timestamptz
               AT TIME ZONE 'America/Santiago'))::int = 21;
    IF v_n <> 1 THEN
      v_fail := v_fail || format('AC12: el %s hay %s corridas a las 21:00 hora Chile (esperado 1)', v_row.day, v_n);
    END IF;
  END LOOP;

  IF array_length(v_fail, 1) > 0 THEN
    RAISE EXCEPTION E'spec 0024-m: % caso(s) fallan:\n- %',
      array_length(v_fail, 1), array_to_string(v_fail, E'\n- ');
  END IF;

  RAISE NOTICE 'spec 0024-m: día de negocio en hora de Chile — todos los casos pasan';
END;
$test$;
