-- ============================================================================
-- Trigger: cascade_promotion_status_to_courses
--
-- Propósito: cuando el status de una professional_promotion cambia,
-- sincroniza el mismo status en todos sus promotion_courses.
--
-- Cubre AMBOS caminos de cambio de estado:
--   1. Manual desde la UI  (UPDATE via facade)
--   2. Automático pg_cron  (auto_transition_promotion_status)
--
-- Mapeo de estados:
--   planned     → courses planned
--   in_progress → courses in_progress
--   finished    → courses finished
--   cancelled   → courses cancelled
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cascade_promotion_status_to_courses()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.promotion_courses
  SET    status = NEW.status
  WHERE  promotion_id = NEW.id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.cascade_promotion_status_to_courses()
  IS 'Disparada tras UPDATE de status en professional_promotions. Propaga el nuevo status a todos los promotion_courses de esa promoción.';

-- Idempotente: DROP + CREATE (no existe CREATE OR REPLACE TRIGGER en PG <14)
DROP TRIGGER IF EXISTS trg_cascade_promotion_status ON public.professional_promotions;

CREATE TRIGGER trg_cascade_promotion_status
  AFTER UPDATE OF status ON public.professional_promotions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.cascade_promotion_status_to_courses();
