-- ============================================================================
-- fix-325-m: no se puede cancelar una promoción que tiene alumnos con matrícula activa.
-- ============================================================================
-- Decisión D4 (Matías, 2026-10-05): una promoción solo se cancela si no tiene matrículas activas.
-- En el piloto no existe dónde reasignar a esos alumnos (mover matrículas entre promociones no está
-- modelado), así que cancelarla los dejaba colgados de una promoción cancelada.
--
-- El editor ya deshabilita "Cancelada" en ese caso; este trigger es la defensa en BD para cualquier
-- otro camino (consola, API). Aplica a todos los roles, también al admin.
-- El mensaje lleva el marcador promotion_has_active_enrollments, que la app traduce
-- (promotionWriteErrorMessage en src/app/core/utils/promotion-code.utils.ts).
--
-- Idempotente: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS / CREATE TRIGGER.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_cancel_promotion_with_active_enrollments()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_active INT;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    SELECT count(*) INTO v_active
      FROM public.enrollments e
      JOIN public.promotion_courses pc ON pc.id = e.promotion_course_id
     WHERE pc.promotion_id = NEW.id
       AND e.status = 'active';

    IF v_active > 0 THEN
      RAISE EXCEPTION 'promotion_has_active_enrollments: la promoción % tiene % matrícula(s) activa(s)',
        NEW.id, v_active
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_cancel_promotion_with_active_enrollments
  ON public.professional_promotions;
CREATE TRIGGER trg_prevent_cancel_promotion_with_active_enrollments
  BEFORE UPDATE OF status ON public.professional_promotions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_cancel_promotion_with_active_enrollments();
