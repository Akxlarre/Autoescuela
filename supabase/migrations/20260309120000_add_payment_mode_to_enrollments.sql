-- ============================================================================
-- Migración: Columna payment_mode en enrollments
-- ============================================================================
-- Agrega payment_mode ('total' | 'partial') para persistir la modalidad de pago
-- elegida en el paso 2 del wizard, independientemente del payment_status.
-- Esto permite rehidratar correctamente el estado al retomar un draft.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrollments' AND column_name = 'payment_mode'
  ) THEN
    ALTER TABLE enrollments
      ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'total'
      CONSTRAINT chk_enrollments_payment_mode CHECK (payment_mode IN ('total', 'partial'));
  END IF;
END;
$$;
