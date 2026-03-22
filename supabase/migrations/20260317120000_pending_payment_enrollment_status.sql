-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260317120000_pending_payment_enrollment_status.sql
-- Soporte para enrollments en estado 'pending_payment':
--   - Documenta el nuevo status en el comentario de columna
--   - Actualiza cleanup_expired_public_enrollment() para cancelar enrollments
--     cuya ventana de pago (payment_attempts.expires_at) venció sin confirmación
-- ─────────────────────────────────────────────────────────────────────────────

-- Actualizar comentario de columna con el nuevo status
COMMENT ON COLUMN public.enrollments.status IS
  'draft | pending_payment | active | inactive | completed | cancelled';

-- ══════════════════════════════════════════════════════════════════════════════
-- Actualizar cleanup_expired_public_enrollment()
-- Ahora también cancela enrollments en pending_payment cuya payment_attempt
-- venció sin ser confirmada (ventana de pago de 2 horas).
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cleanup_expired_public_enrollment()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- Liberar holds cuyo TTL venció
  DELETE FROM public.slot_holds WHERE expires_at < now();

  -- Marcar payment_attempts pendientes vencidos como fallidos
  UPDATE public.payment_attempts
  SET    status = 'failed'
  WHERE  expires_at < now()
    AND  status = 'pending';

  -- Cancelar enrollments pending_payment cuya ventana de pago venció
  UPDATE public.enrollments
  SET    status = 'cancelled'
  WHERE  status = 'pending_payment'
    AND  id IN (
      SELECT enrollment_id
      FROM   public.payment_attempts
      WHERE  status = 'failed'
        AND  enrollment_id IS NOT NULL
    );
$$;
