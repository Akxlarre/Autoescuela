-- ============================================================================
-- fix-323-m: reserve_next_promotion_slot — la cadencia automática ya no se traba ni se corre por
-- promociones manuales, y el número no choca con el de una manual.
-- ============================================================================
-- Decisión D6 (Matías, 2026-10-05): una promoción manual puede ir en cualquier lunes, con número
-- obligatorio. Antes la función:
--   · tomaba la fecha y el número de "la última promoción con número" (ORDER BY start_date DESC):
--     una manual con número fuera de la cadencia corría todas las fechas siguientes;
--   · reservaba "última + 14 días" sin mirar si ese lunes ya estaba ocupado: con una manual ahí,
--     el INSERT chocaba con UNIQUE (branch_id, start_date) y el cron fallaba todos los días (S5);
--   · usaba "número de la última + 1", que podía ser el número que ya tenía una manual
--     (professional_promotions_code_key es UNIQUE en todo el sistema).
--
-- La cadencia es aritmética: lunes 2026-07-27 + múltiplos de 14 días (las automáticas 279 y 280
-- parten el 21-09 y el 05-10). Ahora:
--   · el colchón (2 planificadas por delante, fix-322-m) cuenta solo promociones en la cadencia:
--     una manual fuera de ella no frena a la automática;
--   · la próxima fecha es el siguiente lunes de la cadencia después de la última promoción en la
--     cadencia (de cualquier estado: una cancelada también ocupa su fecha), saltando lunes
--     ocupados por defensa;
--   · el número es el mayor número existente + 1 (en toda la tabla, igual que su UNIQUE).
-- La misma ancla vive en src/app/core/utils/promotion-code.utils.ts (PROMOTION_CADENCE_ANCHOR).
--
-- Permisos sin cambios respecto de fix-322-m (solo service_role); se reafirman por idempotencia.
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
  v_last_start DATE;
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

  -- Última fecha de la cadencia ya usada (cualquier estado).
  SELECT max(start_date) INTO v_last_start
    FROM professional_promotions
    WHERE branch_id = p_branch_id
      AND (start_date - c_anchor) % 14 = 0;

  v_next_start := COALESCE(v_last_start, c_anchor) + 14;
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
  'fix-228-m + fix-322-m + fix-323-m: reserva atómica (advisory lock) del próximo lunes de la cadencia de 14 días desde 2026-07-27, hasta tener 2 planificadas de la cadencia por delante. Las promociones manuales fuera de la cadencia no la afectan. Número = mayor existente + 1. Solo service_role.';

REVOKE EXECUTE ON FUNCTION reserve_next_promotion_slot(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_next_promotion_slot(INT) TO service_role;
