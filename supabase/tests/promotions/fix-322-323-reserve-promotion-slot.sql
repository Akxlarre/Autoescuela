-- ============================================================================
-- Test de reserve_next_promotion_slot — fix-322-m (colchón sin promoción en curso), fix-323-m
-- (cadencia que no se corre por manuales; número = mayor + 1) y fix-344-m (una manual en un lunes
-- futuro de la cadencia no hace saltar los lunes intermedios)
-- ============================================================================
-- Correr como postgres en el SQL Editor de Supabase. NO deja datos: el bloque termina SIEMPRE con
-- una excepción a propósito, que revierte todo lo insertado. El texto de esa excepción dice el
-- resultado:
--   "RESULTADO fix-322/323/344: TODO OK …"      → pasó
--   "RESULTADO fix-322/323/344: N FALLO(S) …"   → falló (detalle en el mismo mensaje)
--
-- Usa sedes de prueba nuevas (no toca la sede 2) salvo el caso D, que solo llama la función sobre
-- la sede 2 real para comprobar que con el colchón completo no reserva nada.
-- Equivale a los Deno.test de supabase/functions/auto-create-next-promotions/index.test.ts, que
-- requieren Supabase local.
-- ============================================================================

DO $test$
DECLARE
  v_log  text[] := '{}';
  v_fail text[] := '{}';
  v_a int; v_b int; v_c int;
  v_counts int[] := '{}';
  v_n int;
  r record;
BEGIN
  -- ── A (fix-322-m): sin promoción en curso, reserva exactamente 2 y para ──
  INSERT INTO branches (name) VALUES ('test fix-322 A') RETURNING id INTO v_a;
  INSERT INTO professional_promotions (code, name, start_date, end_date, status, current_day, branch_id)
  VALUES ('9101', 'A finalizada', '2026-01-12', '2026-02-13', 'finished', 0, v_a);

  FOR i IN 1..5 LOOP
    SELECT count(*) INTO v_n FROM reserve_next_promotion_slot(v_a);
    v_counts := v_counts || v_n;
  END LOOP;
  v_log := v_log || format('A reservas por llamada: %s', v_counts);
  IF v_counts <> ARRAY[1,1,0,0,0] THEN
    v_fail := v_fail || format('A: esperaba {1,1,0,0,0}, obtuvo %s', v_counts);
  END IF;
  SELECT string_agg(start_date::text, ',' ORDER BY start_date) INTO STRICT r
    FROM professional_promotions WHERE branch_id = v_a AND status = 'planned';
  v_log := v_log || format('A fechas reservadas: %s', r);

  -- ── B (fix-323-m): manual fuera de la cadencia no la corre; el número no choca ──
  INSERT INTO branches (name) VALUES ('test fix-323 B') RETURNING id INTO v_b;
  INSERT INTO professional_promotions (code, name, start_date, end_date, status, current_day, branch_id)
  VALUES ('9201', 'B automática en curso', '2026-01-12', '2026-02-13', 'in_progress', 0, v_b),
         ('9202', 'B manual en la cadencia', '2026-01-26', '2026-02-27', 'planned', 0, v_b),
         ('9500', 'B manual fuera de la cadencia', '2026-02-02', '2026-03-06', 'planned', 0, v_b);

  SELECT reserved_code, reserved_start_date INTO r FROM reserve_next_promotion_slot(v_b);
  v_log := v_log || format('B primera reserva: código %s, fecha %s', r.reserved_code, r.reserved_start_date);
  IF r.reserved_start_date IS DISTINCT FROM DATE '2026-02-09' THEN
    v_fail := v_fail || format('B: esperaba fecha 2026-02-09 (cadencia tras 01-26), obtuvo %s', r.reserved_start_date);
  END IF;
  IF r.reserved_code IS DISTINCT FROM '9501' THEN
    v_fail := v_fail || format('B: esperaba código 9501 (mayor + 1), obtuvo %s', r.reserved_code);
  END IF;
  SELECT count(*) INTO v_n FROM reserve_next_promotion_slot(v_b);
  IF v_n <> 0 THEN
    v_fail := v_fail || format('B: con 2 planificadas de la cadencia no debía reservar, reservó %s', v_n);
  END IF;

  -- ── C (fix-344-m): una manual en un lunes futuro de la cadencia no hace saltar los intermedios ──
  INSERT INTO branches (name) VALUES ('test fix-344 C') RETURNING id INTO v_c;
  INSERT INTO professional_promotions (code, name, start_date, end_date, status, current_day, branch_id)
  VALUES ('9301', 'C automática en curso', '2026-01-12', '2026-02-13', 'in_progress', 0, v_c),
         ('9302', 'C manual en la cadencia, más adelante', '2026-02-23', '2026-03-27', 'planned', 0, v_c);

  SELECT reserved_start_date INTO r FROM reserve_next_promotion_slot(v_c);
  v_log := v_log || format('C primera reserva: fecha %s', r.reserved_start_date);
  IF r.reserved_start_date IS DISTINCT FROM DATE '2026-01-26' THEN
    v_fail := v_fail || format('C: esperaba fecha 2026-01-26 (primer lunes libre tras la que ya partió), obtuvo %s', r.reserved_start_date);
  END IF;
  SELECT count(*) INTO v_n FROM reserve_next_promotion_slot(v_c);
  IF v_n <> 0 THEN
    v_fail := v_fail || format('C: con 2 planificadas de la cadencia no debía reservar, reservó %s', v_n);
  END IF;

  -- ── D: la sede 2 real tiene su colchón completo → no reserva nada ──
  SELECT count(*) INTO v_n FROM reserve_next_promotion_slot(2);
  v_log := v_log || format('D sede 2 real: %s reservas', v_n);
  IF v_n <> 0 THEN
    v_fail := v_fail || format('D: la sede 2 tiene 2 planificadas, no debía reservar; reservó %s', v_n);
  END IF;

  -- Siempre aborta: revierte todo lo insertado.
  IF array_length(v_fail, 1) > 0 THEN
    RAISE EXCEPTION E'RESULTADO fix-322/323/344: % FALLO(S)\n%\n---\n%',
      array_length(v_fail, 1), array_to_string(v_fail, E'\n'), array_to_string(v_log, E'\n');
  END IF;
  RAISE EXCEPTION E'RESULTADO fix-322/323/344: TODO OK (se revierte a propósito, no quedan datos)\n%',
    array_to_string(v_log, E'\n');
END
$test$;
