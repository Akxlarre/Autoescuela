-- ============================================================================
-- Simplificar generación de sesiones: eliminar template_blocks y
-- professional_schedule_templates, reemplazar por generación directa L-S
-- desde las fechas de la promoción.
-- ============================================================================

-- 1. Drop trigger y función existentes
DROP TRIGGER IF EXISTS trg_generate_professional_course_sessions ON promotion_courses;
DROP FUNCTION IF EXISTS generate_sessions_from_template();

-- 2. Drop RLS policies de ambas tablas
DROP POLICY IF EXISTS select_schedule_templates ON professional_schedule_templates;
DROP POLICY IF EXISTS insert_schedule_templates ON professional_schedule_templates;
DROP POLICY IF EXISTS update_schedule_templates ON professional_schedule_templates;
DROP POLICY IF EXISTS delete_schedule_templates ON professional_schedule_templates;

DROP POLICY IF EXISTS select_template_blocks ON template_blocks;
DROP POLICY IF EXISTS insert_template_blocks ON template_blocks;
DROP POLICY IF EXISTS update_template_blocks ON template_blocks;
DROP POLICY IF EXISTS delete_template_blocks ON template_blocks;

-- 3. Drop FK column template_id de promotion_courses + su índice implícito
ALTER TABLE promotion_courses DROP COLUMN IF EXISTS template_id;

-- 4. Drop índice explícito de template_blocks
DROP INDEX IF EXISTS idx_template_blocks;

-- 5. Drop tablas (hijo primero, padre después)
DROP TABLE IF EXISTS template_blocks;
DROP TABLE IF EXISTS professional_schedule_templates;

-- ============================================================================
-- 6. Nuevo trigger: genera sesiones L-S automáticamente al crear promotion_course
--    Solo fecha, sin horarios. Cada día hábil (L-S) genera 1 teórica + 1 práctica.
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_sessions_from_promotion()
RETURNS TRIGGER AS $$
DECLARE
  v_start_date DATE;
  v_end_date   DATE;
  v_current    DATE;
  v_dow        INT; -- 0=Sun, 1=Mon ... 6=Sat (EXTRACT DOW)
BEGIN
  -- Obtener fechas de la promoción padre
  SELECT start_date, end_date
    INTO v_start_date, v_end_date
    FROM public.professional_promotions
   WHERE id = NEW.promotion_id;

  IF v_start_date IS NULL OR v_end_date IS NULL THEN
    RETURN NEW;
  END IF;

  v_current := v_start_date;

  -- Iterar cada día del rango
  WHILE v_current <= v_end_date LOOP
    v_dow := EXTRACT(DOW FROM v_current);

    -- Solo L(1) a S(6), excluir Domingo(0)
    IF v_dow BETWEEN 1 AND 6 THEN
      -- Sesión teórica (solo fecha)
      INSERT INTO public.professional_theory_sessions
        (promotion_course_id, date, status, created_at)
      VALUES
        (NEW.id, v_current, 'scheduled', NOW());

      -- Sesión práctica (solo fecha)
      INSERT INTO public.professional_practice_sessions
        (promotion_course_id, date, status, created_at)
      VALUES
        (NEW.id, v_current, 'scheduled', NOW());
    END IF;

    v_current := v_current + 1;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

COMMENT ON FUNCTION generate_sessions_from_promotion()
  IS 'Auto-genera sesiones teóricas y prácticas (solo fecha, sin horario) L-S para cada día hábil entre start_date y end_date de la promoción';

CREATE TRIGGER trg_generate_professional_course_sessions
  AFTER INSERT ON promotion_courses
  FOR EACH ROW
  EXECUTE FUNCTION generate_sessions_from_promotion();
