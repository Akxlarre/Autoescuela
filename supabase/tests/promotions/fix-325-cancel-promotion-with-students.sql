-- ============================================================================
-- Test del trigger de fix-325-m: no se puede cancelar una promoción con matrículas activas.
-- ============================================================================
-- Correr como postgres en el SQL Editor de Supabase, DESPUÉS de aplicar
-- 20261005160000_fix325_professional_promotions_block_cancel_with_students.sql.
-- NO deja cambios: termina SIEMPRE con una excepción a propósito que revierte todo. El texto dice
-- el resultado: "RESULTADO fix-325: TODO OK …" o "RESULTADO fix-325: N FALLO(S) …".
--
-- Caso 1: una promoción real con matrículas activas → cancelarla debe fallar con el marcador
--         promotion_has_active_enrollments (si no hay ninguna en la BD, el caso se informa y se omite).
-- Caso 2: una promoción de prueba sin alumnos (sede de prueba) → cancelarla debe funcionar.
-- ============================================================================

DO $test$
DECLARE
  v_log  text[] := '{}';
  v_fail text[] := '{}';
  v_promo int;
  v_active int;
  v_branch int;
  v_state text;
BEGIN
  -- ── Caso 1 ──
  SELECT pc.promotion_id, count(*) INTO v_promo, v_active
    FROM enrollments e
    JOIN promotion_courses pc ON pc.id = e.promotion_course_id
    JOIN professional_promotions pp ON pp.id = pc.promotion_id
   WHERE e.status = 'active' AND pp.status IN ('planned', 'in_progress')
   GROUP BY pc.promotion_id
   ORDER BY count(*) DESC
   LIMIT 1;

  IF v_promo IS NULL THEN
    -- No hay ninguna en la BD: se prepara una dentro de esta misma transacción (se revierte) con una
    -- matrícula Profesional existente, dejándola activa en una promoción en curso.
    SELECT pc.promotion_id, e.id INTO v_promo, v_active
      FROM enrollments e
      JOIN promotion_courses pc ON pc.id = e.promotion_course_id
     WHERE e.number IS NOT NULL AND e.expires_at IS NULL  -- CHECKs de enrollments fuera de 'draft'
     ORDER BY e.id
     LIMIT 1;
    IF v_promo IS NOT NULL THEN
      UPDATE enrollments SET status = 'active' WHERE id = v_active;
      UPDATE professional_promotions SET status = 'in_progress' WHERE id = v_promo;
      v_log := v_log || format('Caso 1 preparado: matrícula %s activa en promoción %s (se revierte)', v_active, v_promo);
      v_active := 1;
    END IF;
  END IF;

  IF v_promo IS NULL THEN
    v_log := v_log || 'Caso 1 omitido: no hay ninguna matrícula Profesional en esta BD'::text;
  ELSE
    BEGIN
      UPDATE professional_promotions SET status = 'cancelled' WHERE id = v_promo;
      v_state := 'sin error';
    EXCEPTION WHEN OTHERS THEN
      v_state := SQLERRM;
    END;
    v_log := v_log || format('Caso 1: promoción %s con %s activa(s) → %s', v_promo, v_active, v_state);
    IF v_state NOT LIKE 'promotion_has_active_enrollments%' THEN
      v_fail := v_fail || format('Caso 1: esperaba rechazo del trigger, obtuvo "%s"', v_state);
    END IF;
  END IF;

  -- ── Caso 2 ──
  INSERT INTO branches (name) VALUES ('test fix-325') RETURNING id INTO v_branch;
  INSERT INTO professional_promotions (code, name, start_date, end_date, status, current_day, branch_id)
  VALUES ('9601', 'Sin alumnos', '2099-01-05', '2099-02-06', 'planned', 0, v_branch)
  RETURNING id INTO v_promo;
  BEGIN
    UPDATE professional_promotions SET status = 'cancelled' WHERE id = v_promo;
    v_state := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_state := SQLERRM;
  END;
  v_log := v_log || format('Caso 2: promoción sin alumnos → %s', v_state);
  IF v_state <> 'ok' THEN
    v_fail := v_fail || format('Caso 2: debía poder cancelarse, obtuvo "%s"', v_state);
  END IF;

  -- Siempre aborta: revierte todo.
  IF array_length(v_fail, 1) > 0 THEN
    RAISE EXCEPTION E'RESULTADO fix-325: % FALLO(S)\n%\n---\n%',
      array_length(v_fail, 1), array_to_string(v_fail, E'\n'), array_to_string(v_log, E'\n');
  END IF;
  RAISE EXCEPTION E'RESULTADO fix-325: TODO OK (se revierte a propósito, no quedan cambios)\n%',
    array_to_string(v_log, E'\n');
END
$test$;
