-- ============================================================================
-- pg_cron: Transición automática de estado de professional_promotions
--
-- Reglas de negocio:
--   planned     → in_progress  cuando start_date <= hoy y end_date >= hoy
--   in_progress → finished     cuando end_date < hoy
--
-- El estado 'cancelled' nunca es alterado por este job (solo manual).
-- Se procesa 'finished' primero para el edge-case de start_date == end_date.
-- ============================================================================

-- 1. Función de transición
CREATE OR REPLACE FUNCTION public.auto_transition_promotion_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- in_progress → finished: la fecha de término ya pasó
  UPDATE public.professional_promotions
  SET    status     = 'finished',
         updated_at = NOW()
  WHERE  status   = 'in_progress'
    AND  end_date < CURRENT_DATE;

  -- planned → in_progress: la fecha de inicio llegó y el curso aún no terminó
  UPDATE public.professional_promotions
  SET    status     = 'in_progress',
         updated_at = NOW()
  WHERE  status     = 'planned'
    AND  start_date <= CURRENT_DATE
    AND  end_date   >= CURRENT_DATE;
END;
$$;

COMMENT ON FUNCTION public.auto_transition_promotion_status()
  IS 'Invocada por pg_cron a las 06:00 UTC. Transiciona professional_promotions: planned→in_progress→finished según start_date/end_date. No toca ''cancelled''.';

-- 2. Registrar job en pg_cron (idempotente: DROP + re-create)
SELECT cron.unschedule('auto-transition-promotion-status')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'auto-transition-promotion-status'
  );

SELECT cron.schedule(
  'auto-transition-promotion-status',
  '0 6 * * *',   -- diariamente a las 06:00 UTC (≈ 03:00 CLT verano)
  $$ SELECT public.auto_transition_promotion_status(); $$
);
