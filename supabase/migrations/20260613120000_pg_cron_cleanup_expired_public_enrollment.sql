-- ============================================================================
-- pg_cron: Limpieza automática de enrollments públicos abandonados
--
-- Problema: cuando un alumno abandona Webpay sin completar el pago (cierra el
-- tab, pierde conexión, etc.), el enrollment queda en 'pending_payment' y el
-- payment_attempt en 'pending' indefinidamente. La ventana de pago es de 2 h
-- (payment_attempts.expires_at = now() + interval '2 hours').
--
-- Este job corre cada 30 min y llama a cleanup_expired_public_enrollment(),
-- que ya existe (migración 20260317120000) y:
--   1. Borra slot_holds expirados
--   2. Marca payment_attempts vencidos como 'failed'
--   3. Cancela enrollments en 'pending_payment' vinculados a esos attempts
--
-- El fast-path para reintentos inmediatos está en initiate-payment (Edge Fn).
-- Este cron es el safety net para usuarios que nunca regresan.
-- ============================================================================

-- Registrar job en pg_cron (idempotente: DROP + re-create)
SELECT cron.unschedule('cleanup-expired-public-enrollment')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-public-enrollment'
  );

SELECT cron.schedule(
  'cleanup-expired-public-enrollment',
  '*/30 * * * *',  -- cada 30 minutos (queries triviales: indexed DELETE/UPDATE sobre tabla pequeña)
  $$ SELECT public.cleanup_expired_public_enrollment(); $$
);
