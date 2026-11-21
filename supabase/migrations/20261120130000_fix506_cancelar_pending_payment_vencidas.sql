-- ============================================================================
-- fix-506-m: cleanup_expired_public_enrollment() vuelve a cancelar las matrículas pending_payment
-- cuyo pago venció
-- ============================================================================
-- 20260317120000 agregó ese paso y quedó registrada como aplicada, pero en la BD real la función se
-- redefinió después desde el SQL Editor sin él: los checkouts online abandonados quedaban en
-- pending_payment para siempre, con el precio completo como saldo (DG-094, fix-172-b). Esta
-- migración restaura la versión documentada en indices/DATABASE.md. Mantiene SECURITY DEFINER, el
-- search_path de fix-363 y los permisos de fix-191 (CREATE OR REPLACE no toca los GRANT).
-- Test: supabase/tests/rls/fix-506-m-student-surveys-y-pending-payment.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_public_enrollment()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
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
