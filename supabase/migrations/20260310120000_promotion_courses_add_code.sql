-- ============================================================================
-- Agrega columna `code` a promotion_courses
-- Permite identificar cada curso dentro de una promoción con un código libre
-- (ej: "PC-A2-001"), independiente del código del curso base.
-- ============================================================================

ALTER TABLE promotion_courses
  ADD COLUMN IF NOT EXISTS code TEXT;

COMMENT ON COLUMN promotion_courses.code IS 'Código libre del curso dentro de la promoción. Opcional.';
