-- ============================================================================
-- Migración: Registro de auditoría para cambios al Código SENCE del libro
-- ============================================================================
-- Contexto: fix-098-m-codigo-autorizacion-libro-editable (ASG-b-051).
-- El Código Autorizado por SENCE (class_book.sence_code) es un dato oficial
-- verificable en fiscalizaciones MTT. Se permite seguir editándolo aunque el
-- libro esté cerrado, pero debe quedar registro de quién lo cambió y cuándo.
-- ============================================================================

ALTER TABLE class_book
  ADD COLUMN IF NOT EXISTS sence_code_updated_by INT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS sence_code_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN class_book.sence_code_updated_by IS
  'Usuario (admin o secretaría) que registró el último cambio del Código SENCE';
COMMENT ON COLUMN class_book.sence_code_updated_at IS
  'Fecha/hora del último cambio del Código SENCE';
