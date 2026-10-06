-- ============================================================================
-- fix-322-m: reserve_next_promotion_slot — colchón sin depender de una promoción en curso, y
-- ejecución solo para el rol de servicio.
-- ============================================================================
-- 1. Colchón. La función solo cortaba con `in_progress >= 1 AND planned >= 2`. Sin ninguna en
--    curso (se finalizó o canceló a mano la única) la condición nunca se cumplía y la Edge Function
--    auto-create-next-promotions reservaba 10 planificadas por llamada (su tope defensivo), todos
--    los días. El colchón son 2 planificadas por delante: que haya o no una en curso no cambia
--    cuántas faltan. Ahora corta con `planned >= 2`.
--
-- 2. Permisos. Es SECURITY DEFINER y 20260513000002 da EXECUTE sobre todas las funciones de public
--    a authenticated; además Postgres da EXECUTE a PUBLIC por defecto. Probado el 2026-10-05 con la
--    anon key sin sesión: la función se ejecutó hasta el INSERT. Así se saltaba la protección que
--    fix-043-i puso en la Edge Function. Solo la llama esa función (con la service key), así que se
--    revoca a todos los demás roles.
--
-- El resto del cuerpo queda igual que en 20260829110000 (fix-228-m). fix-323-m vuelve a
-- reemplazarla para la cadencia de las promociones manuales.
-- Idempotente: CREATE OR REPLACE + REVOKE/GRANT.
-- ============================================================================

CREATE OR REPLACE FUNCTION reserve_next_promotion_slot(p_branch_id INT)
RETURNS TABLE (promotion_id INT, reserved_code TEXT, reserved_start_date DATE)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_planned_count INT;
  v_last_start DATE;
  v_last_code INT;
  v_next_code TEXT;
  v_next_start DATE;
  v_new_id INT;
BEGIN
  -- Serializa todas las llamadas concurrentes para esta sede: la segunda
  -- espera a que la primera confirme (COMMIT, incluido su INSERT) antes de
  -- poder leer los conteos.
  PERFORM pg_advisory_xact_lock(hashtext('reserve_next_promotion_slot:' || p_branch_id));

  SELECT count(*) INTO v_planned_count
    FROM professional_promotions
    WHERE branch_id = p_branch_id AND status = 'planned';

  -- Colchón completo (2 planificadas por delante) -> nada que reservar.
  IF v_planned_count >= 2 THEN
    RETURN;
  END IF;

  SELECT p.start_date, p.code::INT
    INTO v_last_start, v_last_code
    FROM professional_promotions p
    WHERE p.branch_id = p_branch_id AND p.code ~ '^\d+$'
    ORDER BY p.start_date DESC
    LIMIT 1;

  IF v_last_start IS NULL THEN
    -- Defensa ante tabla vacía, igual que el fallback previo de la Edge Function.
    v_last_start := '2026-07-27'::DATE;
    v_last_code := 275;
  END IF;

  v_next_code := (v_last_code + 1)::TEXT;
  v_next_start := v_last_start + INTERVAL '14 days';

  -- Placeholder: end_date real (con recuperación de feriados) y name los
  -- completa la Edge Function con UPDATE tras el fetch de feriados.
  INSERT INTO professional_promotions
    (code, name, start_date, end_date, status, current_day, branch_id)
  VALUES
    (v_next_code, 'Promoción ' || v_next_code, v_next_start, v_next_start, 'planned', 0, p_branch_id)
  RETURNING id INTO v_new_id;

  promotion_id := v_new_id;
  reserved_code := v_next_code;
  reserved_start_date := v_next_start;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION reserve_next_promotion_slot(INT) IS
  'fix-228-m + fix-322-m: reserva e inserta atómicamente (advisory lock) el próximo slot de promoción hasta tener 2 planificadas por delante. Solo service_role.';

REVOKE EXECUTE ON FUNCTION reserve_next_promotion_slot(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_next_promotion_slot(INT) TO service_role;
