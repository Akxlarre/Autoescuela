-- ============================================================================
-- fix-228-m: elimina la race condition de auto-create-next-promotions.
--
-- La Edge Function decidía "cuántas promociones faltan" leyendo conteos con
-- dos queries separadas y luego insertaba en un loop, sin ningún lock entre
-- el conteo y el insert. Dos ejecuciones solapadas podían leer el mismo
-- conteo desactualizado y ambas insertar, creando planificadas de más
-- (causa raíz de fix-228-m: 3 promociones extra en producción, ver fix.md).
--
-- Esta migración cierra la clase de bug completa con dos capas:
--   1. UNIQUE (branch_id, start_date): estructuralmente imposible duplicar
--      la misma fecha de inicio para una sede.
--   2. reserve_next_promotion_slot(): toma pg_advisory_xact_lock() como
--      primera línea y, si falta una promoción para completar el colchón,
--      INSERTA el placeholder ahí mismo, dentro de la misma transacción
--      bloqueada — no solo calcula el próximo slot. Así, una segunda llamada
--      concurrente que espera el lock ve, al obtenerlo, el conteo YA
--      actualizado por la primera (su INSERT quedó confirmado antes de que
--      la segunda pueda leer), y devuelve NULL si el colchón ya está
--      completo. Si solo se devolviera el cálculo (sin insertar bajo el
--      lock), el fetch de feriados en la Edge Function (HTTP externo, lento)
--      dejaría una ventana entre "calcular" e "insertar" donde una segunda
--      llamada seguiría viendo el conteo viejo y reservaría el mismo slot —
--      el UNIQUE constraint evitaría la fila duplicada, pero seguiría siendo
--      una condición de carrera con un insert que falla en vez de no
--      dispararse.
--
-- La Edge Function (auto-create-next-promotions/index.ts) ahora completa el
-- placeholder con UPDATE (end_date real con recuperación de feriados, name)
-- en vez de hacer el INSERT inicial de professional_promotions.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'professional_promotions_branch_start_date_key'
  ) THEN
    ALTER TABLE professional_promotions
      ADD CONSTRAINT professional_promotions_branch_start_date_key
      UNIQUE (branch_id, start_date);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION reserve_next_promotion_slot(p_branch_id INT)
RETURNS TABLE (promotion_id INT, reserved_code TEXT, reserved_start_date DATE)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_active_count INT;
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

  SELECT count(*) INTO v_active_count
    FROM professional_promotions
    WHERE branch_id = p_branch_id AND status = 'in_progress';

  SELECT count(*) INTO v_planned_count
    FROM professional_promotions
    WHERE branch_id = p_branch_id AND status = 'planned';

  -- Colchón ya completo (1 in_progress + 2 planned) -> nada que reservar.
  IF v_active_count >= 1 AND v_planned_count >= 2 THEN
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
  'fix-228-m: reserva e inserta atómicamente (advisory lock) el próximo slot de promoción para mantener el colchón de 1 in_progress + 2 planned sin duplicados por condición de carrera.';
