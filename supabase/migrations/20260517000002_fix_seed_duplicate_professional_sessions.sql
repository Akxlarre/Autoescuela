-- ============================================================================
-- Fix: Eliminar sesiones duplicadas del seed PROM-2026-SEED-01
--
-- Causa: El trigger `trg_generate_professional_course_sessions` crea sesiones
-- automáticamente al INSERT en promotion_courses. El seed luego insertaba
-- manualmente otras 30 sesiones (con notes '[SEED] ...'), duplicando cada día.
--
-- Solución: Eliminar las sesiones creadas por el trigger (sin notes de seed),
-- conservando solo las insertadas manualmente por el seed (con notes).
-- Si el seed ya no existe con notes (entorno limpio), se elimina nada — idempotente.
-- ============================================================================

DO $$
DECLARE
  v_pc_a4_id INT;
  v_pc_a2_id INT;
BEGIN
  SELECT id INTO v_pc_a4_id FROM promotion_courses WHERE code = 'PC-SEED-A4-01';
  SELECT id INTO v_pc_a2_id FROM promotion_courses WHERE code = 'PC-SEED-A2-01';

  IF v_pc_a4_id IS NULL AND v_pc_a2_id IS NULL THEN
    RETURN; -- seed no aplicado, nada que limpiar
  END IF;

  -- Eliminar sesiones teóricas del trigger (notes IS NULL o no contiene '[SEED]')
  -- para los cursos de la promoción seed, siempre que existan las del seed como respaldo.
  IF v_pc_a4_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM professional_theory_sessions
                 WHERE promotion_course_id = v_pc_a4_id AND notes LIKE '[SEED]%')
  THEN
    DELETE FROM professional_theory_sessions
    WHERE promotion_course_id = v_pc_a4_id
      AND (notes IS NULL OR notes NOT LIKE '[SEED]%');
  END IF;

  IF v_pc_a2_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM professional_theory_sessions
                 WHERE promotion_course_id = v_pc_a2_id AND notes LIKE '[SEED]%')
  THEN
    DELETE FROM professional_theory_sessions
    WHERE promotion_course_id = v_pc_a2_id
      AND (notes IS NULL OR notes NOT LIKE '[SEED]%');
  END IF;

  -- Eliminar sesiones prácticas del trigger (mismo criterio)
  IF v_pc_a4_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM professional_practice_sessions
                 WHERE promotion_course_id = v_pc_a4_id AND notes LIKE '[SEED]%')
  THEN
    DELETE FROM professional_practice_sessions
    WHERE promotion_course_id = v_pc_a4_id
      AND (notes IS NULL OR notes NOT LIKE '[SEED]%');
  END IF;

  IF v_pc_a2_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM professional_practice_sessions
                 WHERE promotion_course_id = v_pc_a2_id AND notes LIKE '[SEED]%')
  THEN
    DELETE FROM professional_practice_sessions
    WHERE promotion_course_id = v_pc_a2_id
      AND (notes IS NULL OR notes NOT LIKE '[SEED]%');
  END IF;

END $$;
