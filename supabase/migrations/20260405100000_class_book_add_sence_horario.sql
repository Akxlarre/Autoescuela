-- ============================================================================
-- Migración: Agregar campos editables al Libro de Clases
-- ============================================================================
-- Contexto: El Libro de Clases (class_book) necesita almacenar el Código SENCE
-- autorizado y el horario de clases, que son datos específicos del libro y no
-- se derivan de otras tablas.
-- ============================================================================

-- 1. Agregar columnas
ALTER TABLE class_book
  ADD COLUMN IF NOT EXISTS sence_code TEXT,
  ADD COLUMN IF NOT EXISTS horario    TEXT;

COMMENT ON COLUMN class_book.sence_code IS 'Código autorizado por SENCE para este curso profesional';
COMMENT ON COLUMN class_book.horario    IS 'Horario de clases en texto libre (ej: "L-V 17:30-22:30, S 9:00-14:00")';

-- 2. Crear registro automáticamente para cada promotion_course que no tenga uno
-- Esto evita que el usuario tenga que "crear" el libro manualmente
INSERT INTO class_book (branch_id, promotion_course_id, period, status)
SELECT
  pp.branch_id,
  pc.id,
  pp.code,
  CASE
    WHEN pp.status = 'finished' THEN 'closed'
    WHEN pp.status = 'in_progress' THEN 'active'
    ELSE 'draft'
  END
FROM promotion_courses pc
JOIN professional_promotions pp ON pp.id = pc.promotion_id
WHERE NOT EXISTS (
  SELECT 1 FROM class_book cb WHERE cb.promotion_course_id = pc.id
);
