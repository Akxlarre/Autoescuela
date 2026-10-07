-- ============================================================================
-- Test de delete_promotion_without_students — fix-348-m (eliminar en vez de cancelar)
-- ============================================================================
-- Correr como postgres en el SQL Editor de Supabase, DESPUÉS de aplicar
-- 20261006170000_fix348_delete_promotion_without_students.sql.
-- NO deja cambios: termina SIEMPRE con una excepción a propósito que revierte todo. El texto dice
-- el resultado: "RESULTADO fix-348: TODO OK …" o "RESULTADO fix-348: N FALLO(S) …".
--
-- Caso 1: planificada sin alumnos (sede de prueba, con un curso y sus sesiones) → se elimina con
--         todo lo suyo y quedan libres su lunes y su número.
-- Caso 2: en curso → rechazada (promotion_not_deletable).
-- Caso 3: no existe → rechazada (promotion_not_found).
-- Caso 4: con una matrícula real → rechazada (promotion_has_enrollments). Usa una matrícula
--         Profesional existente y deja su promoción como planificada dentro de la transacción
--         (se revierte). Si no hay ninguna en la BD, el caso se informa y se omite.
-- Caso 5: un usuario que no es admin → rechazado. Simula su sesión dentro de la transacción.
-- ============================================================================

DO $test$
DECLARE
  v_log  text[] := '{}';
  v_fail text[] := '{}';
  v_branch int;
  v_course int;
  v_promo int;
  v_pc int;
  v_sessions int;
  v_left int;
  v_state text;
  v_uid uuid;
BEGIN
  INSERT INTO branches (name) VALUES ('test fix-348') RETURNING id INTO v_branch;
  SELECT id INTO v_course FROM courses
   WHERE type = 'professional' AND is_convalidation = false ORDER BY id LIMIT 1;

  -- ── Caso 1: planificada sin alumnos ──
  INSERT INTO professional_promotions (code, name, start_date, end_date, status, current_day, branch_id)
  VALUES ('9601', 'fix-348 planificada', '2026-03-09', '2026-04-11', 'planned', 0, v_branch)
  RETURNING id INTO v_promo;
  INSERT INTO promotion_courses (promotion_id, course_id, max_students, status)
  VALUES (v_promo, v_course, 25, 'planned') RETURNING id INTO v_pc;
  SELECT (SELECT count(*) FROM professional_theory_sessions WHERE promotion_course_id = v_pc)
       + (SELECT count(*) FROM professional_practice_sessions WHERE promotion_course_id = v_pc)
    INTO v_sessions;
  v_log := v_log || format('Caso 1 preparado: promoción %s, curso %s, %s sesiones', v_promo, v_pc, v_sessions);

  BEGIN
    PERFORM delete_promotion_without_students(v_promo);
    v_state := 'sin error';
  EXCEPTION WHEN OTHERS THEN
    v_state := SQLERRM;
  END;
  SELECT (SELECT count(*) FROM professional_promotions WHERE id = v_promo)
       + (SELECT count(*) FROM promotion_courses WHERE promotion_id = v_promo)
       + (SELECT count(*) FROM professional_theory_sessions WHERE promotion_course_id = v_pc)
       + (SELECT count(*) FROM professional_practice_sessions WHERE promotion_course_id = v_pc)
    INTO v_left;
  v_log := v_log || format('Caso 1: eliminar → %s; filas que quedaron: %s', v_state, v_left);
  IF v_state <> 'sin error' OR v_left <> 0 THEN
    v_fail := v_fail || format('Caso 1: esperaba eliminar todo, obtuvo "%s" y quedaron %s filas', v_state, v_left);
  END IF;

  BEGIN
    INSERT INTO professional_promotions (code, name, start_date, end_date, status, current_day, branch_id)
    VALUES ('9601', 'fix-348 reutiliza lunes y número', '2026-03-09', '2026-04-11', 'planned', 0, v_branch);
    v_state := 'sin error';
  EXCEPTION WHEN OTHERS THEN
    v_state := SQLERRM;
  END;
  v_log := v_log || format('Caso 1: volver a usar el mismo lunes y número → %s', v_state);
  IF v_state <> 'sin error' THEN
    v_fail := v_fail || format('Caso 1: el lunes o el número no quedaron libres: %s', v_state);
  END IF;

  -- ── Caso 2: en curso ──
  INSERT INTO professional_promotions (code, name, start_date, end_date, status, current_day, branch_id)
  VALUES ('9602', 'fix-348 en curso', '2026-02-23', '2026-03-28', 'in_progress', 0, v_branch)
  RETURNING id INTO v_promo;
  BEGIN
    PERFORM delete_promotion_without_students(v_promo);
    v_state := 'sin error';
  EXCEPTION WHEN OTHERS THEN
    v_state := SQLERRM;
  END;
  v_log := v_log || format('Caso 2: en curso → %s', v_state);
  IF v_state NOT LIKE 'promotion_not_deletable%' THEN
    v_fail := v_fail || format('Caso 2: esperaba promotion_not_deletable, obtuvo "%s"', v_state);
  END IF;

  -- ── Caso 3: no existe ──
  BEGIN
    PERFORM delete_promotion_without_students(-1);
    v_state := 'sin error';
  EXCEPTION WHEN OTHERS THEN
    v_state := SQLERRM;
  END;
  v_log := v_log || format('Caso 3: no existe → %s', v_state);
  IF v_state NOT LIKE 'promotion_not_found%' THEN
    v_fail := v_fail || format('Caso 3: esperaba promotion_not_found, obtuvo "%s"', v_state);
  END IF;

  -- ── Caso 4: con una matrícula ──
  SELECT pc.promotion_id INTO v_promo
    FROM enrollments e
    JOIN promotion_courses pc ON pc.id = e.promotion_course_id
   WHERE e.status <> 'draft'
   ORDER BY e.id DESC
   LIMIT 1;
  IF v_promo IS NULL THEN
    v_log := v_log || 'Caso 4 omitido: no hay ninguna matrícula Profesional con promoción en esta BD'::text;
  ELSE
    UPDATE professional_promotions SET status = 'planned' WHERE id = v_promo;
    BEGIN
      PERFORM delete_promotion_without_students(v_promo);
      v_state := 'sin error';
    EXCEPTION WHEN OTHERS THEN
      v_state := SQLERRM;
    END;
    v_log := v_log || format('Caso 4: promoción %s con matrícula → %s', v_promo, v_state);
    IF v_state NOT LIKE 'promotion_has_enrollments%' THEN
      v_fail := v_fail || format('Caso 4: esperaba promotion_has_enrollments, obtuvo "%s"', v_state);
    END IF;
  END IF;

  -- ── Caso 5: no es admin ──
  SELECT u.supabase_uid INTO v_uid
    FROM users u JOIN roles r ON r.id = u.role_id
   WHERE r.name = 'secretary' AND u.supabase_uid IS NOT NULL
   ORDER BY u.id LIMIT 1;
  IF v_uid IS NULL THEN
    v_log := v_log || 'Caso 5 omitido: no hay ninguna secretaria con cuenta en esta BD'::text;
  ELSE
    INSERT INTO professional_promotions (code, name, start_date, end_date, status, current_day, branch_id)
    VALUES ('9603', 'fix-348 no admin', '2026-03-23', '2026-04-25', 'planned', 0, v_branch)
    RETURNING id INTO v_promo;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
    BEGIN
      PERFORM delete_promotion_without_students(v_promo);
      v_state := 'sin error';
    EXCEPTION WHEN OTHERS THEN
      v_state := SQLERRM;
    END;
    PERFORM set_config('request.jwt.claims', '', true);
    v_log := v_log || format('Caso 5: secretaria → %s', v_state);
    IF v_state NOT LIKE 'Solo un administrador%' THEN
      v_fail := v_fail || format('Caso 5: esperaba el rechazo por rol, obtuvo "%s"', v_state);
    END IF;
  END IF;

  -- Siempre aborta: revierte todo lo insertado y modificado.
  IF array_length(v_fail, 1) > 0 THEN
    RAISE EXCEPTION E'RESULTADO fix-348: % FALLO(S)\n%\n---\n%',
      array_length(v_fail, 1), array_to_string(v_fail, E'\n'), array_to_string(v_log, E'\n');
  END IF;
  RAISE EXCEPTION E'RESULTADO fix-348: TODO OK (se revierte a propósito, no quedan datos)\n%',
    array_to_string(v_log, E'\n');
END
$test$;
