-- ============================================================================
-- fix-196-m: al finalizar una promoción profesional, marcar sus matrículas
-- activas como ex-alumno (enrollments.status = 'completed').
--
-- `cascade_promotion_status_to_courses()` ya se dispara tras cualquier UPDATE
-- de status en professional_promotions (cron auto_transition_promotion_status
-- o cambio manual desde la UI) y propaga el status a promotion_courses. Se
-- extiende para que, solo cuando el nuevo status es 'finished', también
-- transicione a 'completed' las enrollments activas de esa promoción — mismo
-- efecto que marcarComoExAlumno() (fix-012-i) pero automático y sin gate de
-- certificado (Clase Profesional no tiene ese flujo de envío por email).
--
-- No toca enrollments en 'draft' / 'pending_payment' / 'cancelled' / ya
-- 'completed' — solo las que estaban efectivamente cursando ('active').
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

  IF NEW.status = 'finished' THEN
    UPDATE public.enrollments
    SET    status     = 'completed',
           updated_at = NOW()
    WHERE  status = 'active'
      AND  promotion_course_id IN (
             SELECT id FROM public.promotion_courses WHERE promotion_id = NEW.id
           );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.cascade_promotion_status_to_courses()
  IS 'Disparada tras UPDATE de status en professional_promotions. Propaga el nuevo status a todos los promotion_courses de esa promoción. Si el nuevo status es ''finished'', además marca como ''completed'' (ex-alumno) las enrollments activas de esa promoción (fix-196-m).';
