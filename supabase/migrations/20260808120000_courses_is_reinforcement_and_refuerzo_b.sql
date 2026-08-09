-- ============================================================================
-- Curso "Refuerzo Clase B" (6 clases prácticas) — spec 0006-m / ASG-b-038
--
-- Decisión de diseño (ver specs/specs/0006-m-matricula-refuerzo-clase-b/plan.md §4):
--   license_class SE MANTIENE en 'B' para heredar gratis:
--     - la numeración de matrícula (get_next_enrollment_number() decide por
--       license_class='B' como booleano, no por un tercer grupo)
--     - enrollments.license_group='class_b' (set_enrollment_license_group() y el
--       CHECK constraint de esa columna solo admiten 'class_b'|'professional', sin
--       un tercer valor)
--   Se distingue del Clase B estándar (12 prácticas) con una columna nueva
--   is_reinforcement, mismo patrón ya usado para SENCE (courses.code contiene
--   'sence' → findCourseByLicenseClass() ya soporta desambiguar por variante).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Columna is_reinforcement
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS is_reinforcement BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN courses.is_reinforcement IS
  'true = curso de refuerzo Clase B (6 clases prácticas, no candidato a certificado '
  'Clase B ni a las 12 prácticas estándar). Comparte license_class=''B'' con el Clase B '
  'estándar para heredar la numeración de matrícula y license_group=''class_b'' sin '
  'tocar triggers/RLS existentes; se distingue vía esta columna, mismo patrón ya usado '
  'para SENCE (courses.code). Ver spec 0006-m.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Una fila "Refuerzo Clase B" por sede activa que ya tenga un Clase B estándar
--    (no SENCE, no reforzado). Precio = mitad del base_price vigente de ese curso.
--    Idempotente: no duplica si ya existe una fila reforzada para la sede.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO courses (
  code, name, type, license_class, branch_id,
  duration_weeks, practical_hours, theory_hours, base_price, is_reinforcement, active
)
SELECT
  'refuerzo_b_' || b.id,
  'Refuerzo Clase B',
  'class_b',
  'B',
  b.id,
  4,
  4.5,   -- 6 clases × 45 min ÷ 60
  0,
  ROUND(cb.base_price / 2.0),
  true,
  true
FROM branches b
JOIN LATERAL (
  SELECT base_price
  FROM courses c
  WHERE c.branch_id = b.id
    AND c.license_class = 'B'
    AND c.is_reinforcement = false
    AND c.code NOT ILIKE '%sence%'
  ORDER BY c.id
  LIMIT 1
) cb ON true
WHERE b.active = true
  AND NOT EXISTS (
    SELECT 1 FROM courses c
    WHERE c.branch_id = b.id
      AND c.is_reinforcement = true
  );
