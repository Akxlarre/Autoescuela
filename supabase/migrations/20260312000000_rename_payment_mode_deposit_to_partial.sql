-- ============================================================================
-- Migración: Renombrar valor 'deposit' → 'partial' en payment_mode
-- ============================================================================
-- El valor 'deposit' fue renombrado a 'partial' para mayor claridad semántica.
-- Esta migración actualiza el constraint y los datos existentes.
-- ============================================================================

-- 1. Actualizar filas existentes con valor 'deposit' → 'partial'
UPDATE enrollments
SET payment_mode = 'partial'
WHERE payment_mode = 'deposit';

-- 2. Reemplazar el constraint con el nuevo valor permitido
ALTER TABLE enrollments
  DROP CONSTRAINT IF EXISTS chk_enrollments_payment_mode;

ALTER TABLE enrollments
  ADD CONSTRAINT chk_enrollments_payment_mode
    CHECK (payment_mode IN ('total', 'partial'));
