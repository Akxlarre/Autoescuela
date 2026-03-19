-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260317150000_fix_enrollment_number_constraint_pending_payment.sql
-- Corrige chk_enrollment_number para permitir number = NULL en enrollments
-- con status 'pending_payment' y 'cancelled'.
--
-- Contexto:
--   El flujo de pago online crea el enrollment en 'pending_payment' sin número.
--   El número se asigna únicamente al confirmar el pago (confirm-payment).
--   Los enrollments que se cancelen por timeout de pago tampoco tendrán número.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.enrollments
  DROP CONSTRAINT IF EXISTS chk_enrollment_number;

ALTER TABLE public.enrollments
  ADD CONSTRAINT chk_enrollment_number
    CHECK (status IN ('draft', 'pending_payment', 'cancelled') OR number IS NOT NULL);
