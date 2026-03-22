-- ============================================================================
-- 20260320000000 — Agregar columnas faltantes a professional_pre_registrations
--
-- La Edge Function 'public-enrollment' enviaba campos que no existían en la
-- tabla original. Se agregan las columnas necesarias para el flujo online.
-- ============================================================================

ALTER TABLE professional_pre_registrations
  ADD COLUMN IF NOT EXISTS branch_id                   INT REFERENCES branches(id),
  ADD COLUMN IF NOT EXISTS requested_license_class     TEXT,
  ADD COLUMN IF NOT EXISTS convalidates_simultaneously BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registration_channel        TEXT NOT NULL DEFAULT 'presencial',
  ADD COLUMN IF NOT EXISTS notes                       TEXT;

-- Migrar datos existentes: copiar desired_course_class → requested_license_class
UPDATE professional_pre_registrations
  SET requested_license_class = desired_course_class
  WHERE requested_license_class IS NULL;

ALTER TABLE professional_pre_registrations
  ALTER COLUMN desired_course_class DROP NOT NULL;
