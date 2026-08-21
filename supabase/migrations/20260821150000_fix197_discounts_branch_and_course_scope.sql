-- ============================================================================
-- fix-197-m — Descuentos: scope por sede y por curso específico (incl. CONV)
-- ============================================================================
-- Antes, `discounts.applicable_to` solo distinguía 3 baldes ('all' | 'class_b' |
-- 'professional'), sin poder targetear una sede puntual ni un curso profesional
-- específico (ej. solo A2, o solo la CONV A2/A4). Se agregan dos columnas
-- nullable: NULL = sin restricción (todas las sedes / no atado a un curso puntual,
-- usa el balde de applicable_to).
-- ============================================================================

ALTER TABLE discounts
  ADD COLUMN IF NOT EXISTS branch_id INT REFERENCES branches(id),
  ADD COLUMN IF NOT EXISTS course_id INT REFERENCES courses(id);

COMMENT ON COLUMN discounts.branch_id IS 'NULL = aplica a todas las sedes; con valor = solo esa sede';
COMMENT ON COLUMN discounts.course_id IS 'NULL = usa el balde applicable_to; con valor = solo ese curso puntual (incl. CONV)';
