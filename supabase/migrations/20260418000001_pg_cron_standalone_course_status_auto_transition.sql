-- ============================================================================
-- pg_cron: Transición automática de estado de standalone_courses
--
-- Reglas de negocio:
--   upcoming → active   cuando start_date <= hoy
--
-- Los estados 'completed' y 'cancelled' nunca son alterados por este job
-- (solo manual, vía acción explícita del admin en el drawer de detalle).
-- ============================================================================

-- 1. Función de transición
CREATE OR REPLACE FUNCTION public.auto_transition_standalone_course_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.standalone_courses
  SET    status     = 'active',
         updated_at = NOW()
  WHERE  status     = 'upcoming'
    AND  start_date <= CURRENT_DATE;
END;
$$;

COMMENT ON FUNCTION public.auto_transition_standalone_course_status()
  IS 'Invocada por pg_cron a las 06:00 UTC. Transiciona standalone_courses: upcoming→active cuando start_date <= hoy. No toca ''completed'' ni ''cancelled''.';

-- 2. Registrar job en pg_cron (idempotente: DROP + re-create)
SELECT cron.unschedule('auto-transition-standalone-course-status')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'auto-transition-standalone-course-status'
  );

SELECT cron.schedule(
  'auto-transition-standalone-course-status',
  '0 6 * * *',   -- diariamente a las 06:00 UTC (≈ 03:00 CLT verano)
  $$ SELECT public.auto_transition_standalone_course_status(); $$
);
