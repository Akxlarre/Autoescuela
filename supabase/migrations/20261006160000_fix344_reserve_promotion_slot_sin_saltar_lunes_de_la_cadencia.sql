-- ============================================================================
-- fix-344-m: reserve_next_promotion_slot — una promoción puesta a mano en un lunes futuro de la
-- cadencia ya no hace que la automática se salte los lunes intermedios.
-- ============================================================================
-- Desde fix-323-m la próxima fecha era "la última promoción de la cadencia (de cualquier estado)
-- + 14 días". Si el admin programa una manual en un lunes de la cadencia más adelante, o queda una
-- cancelada ahí, esa pasa a ser "la última" y la reserva se hace después de ella: los lunes de la
-- cadencia que quedaron en medio no se crean nunca. Caso visto: con una promoción el 2026-11-30,
-- la siguiente automática habría sido el 2026-12-14 y el 2026-11-16 quedaba sin promoción.
--
-- Ahora la próxima fecha es el primer lunes LIBRE de la cadencia después de la última promoción
-- de la cadencia que YA PARTIÓ (en curso o finalizada). Una planificada o cancelada más adelante
-- ocupa su lunes (se salta), pero no corre el punto de partida. Si ninguna partió todavía se
-- cuenta desde la más antigua de la cadencia; con la tabla vacía, desde el ancla (igual que antes).
--
-- Colchón (2 planificadas de la cadencia), número (mayor existente + 1), bloqueo y permisos quedan
-- igual que en fix-322-m / fix-323-m.
-- Idempotente: CREATE OR REPLACE + REVOKE/GRANT.
-- ============================================================================

CREATE OR REPLACE FUNCTION reserve_next_promotion_slot(p_branch_id INT)
RETURNS TABLE (promotion_id INT, reserved_code TEXT, reserved_start_date DATE)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  c_anchor CONSTANT DATE := '2026-07-27';
  v_planned_count INT;
  v_base DATE;
  v_max_code INT;
  v_next_code TEXT;
  v_next_start DATE;
  v_new_id INT;
BEGIN
  -- Serializa todas las llamadas concurrentes para esta sede (fix-228-m).
  PERFORM pg_advisory_xact_lock(hashtext('reserve_next_promotion_slot:' || p_branch_id));

  -- Colchón: 2 planificadas por delante, contando solo las de la cadencia.
  SELECT count(*) INTO v_planned_count
    FROM professional_promotions
    WHERE branch_id = p_branch_id
      AND status = 'planned'
      AND (start_date - c_anchor) % 14 = 0;

  IF v_planned_count >= 2 THEN
    RETURN;
  END IF;

  -- Punto de partida: la última promoción de la cadencia que ya partió.
  SELECT max(start_date) INTO v_base
    FROM professional_promotions
    WHERE branch_id = p_branch_id
      AND status IN ('in_progress', 'finished')
      AND (start_date - c_anchor) % 14 = 0;

  -- Ninguna partió todavía: desde la más antigua de la cadencia (ella misma ocupa su lunes).
  IF v_base IS NULL THEN
    SELECT min(start_date) - 14 INTO v_base
      FROM professional_promotions
      WHERE branch_id = p_branch_id
        AND (start_date - c_anchor) % 14 = 0;
  END IF;

  -- Primer lunes libre de la cadencia después del punto de partida.
  v_next_start := COALESCE(v_base, c_anchor) + 14;
  WHILE EXISTS (
    SELECT 1 FROM professional_promotions
     WHERE branch_id = p_branch_id AND start_date = v_next_start
  ) LOOP
    v_next_start := v_next_start + 14;
  END LOOP;

  -- Número: mayor existente + 1 (code es UNIQUE en toda la tabla). Fallback = primer número 276.
  SELECT max(code::INT) INTO v_max_code
    FROM professional_promotions
    WHERE code ~ '^\d+$';
  v_next_code := (COALESCE(v_max_code, 275) + 1)::TEXT;

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
  'fix-228-m + fix-322-m + fix-323-m + fix-344-m: reserva atómica (advisory lock) del primer lunes libre de la cadencia de 14 días desde 2026-07-27, contado desde la última promoción de la cadencia que ya partió, hasta tener 2 planificadas de la cadencia por delante. Las manuales no corren la cadencia. Número = mayor existente + 1. Solo service_role.';

REVOKE EXECUTE ON FUNCTION reserve_next_promotion_slot(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_next_promotion_slot(INT) TO service_role;
