-- ============================================================================
-- Convalidaciones simultáneas: flag en courses + catálogo CONV A3/A4
-- ============================================================================
-- Contexto de negocio:
--   Es posible matricularse en A2 convalidando A4 al mismo tiempo (A2 es "madre"),
--   y también en A5 convalidando A3 (A5 es "madre"). El alumno recibe UN SOLO
--   enrollment con UN SOLO número de matrícula, y es registrado bajo el curso madre
--   en la promoción. Los cursos CONV A3 / CONV A4 son contenedores de sesiones
--   académicas dentro de la misma promoción; NO generan enrollments propios y NO
--   cuentan contra el cupo de 25 por curso ni de 100 por promoción.
-- ============================================================================

-- 1. Flag en courses para distinguir cursos de convalidación del catálogo normal.
--    La UI y las validaciones de cupo deben filtrar is_convalidation = true.
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS is_convalidation BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN courses.is_convalidation IS
  'true = curso de convalidación simultánea (CONV A4 o CONV A3). '
  'No genera enrollments propios; es un contenedor de sesiones para alumnos '
  'que convalidan dentro de una promoción. No cuenta contra cupo de 25/100.';

-- 2. Insertar los dos cursos de convalidación.
--    base_price = 0 porque no tienen precio propio (el precio cubre la matrícula madre).
--    Las horas son referenciales; la reducción real se almacena en license_validations.reduced_hours.
INSERT INTO courses (
  code, name, type, duration_weeks,
  practical_hours, theory_hours, base_price,
  license_class, branch_id, is_convalidation
) VALUES
  (
    'conv_a4',
    'Convalidación A4 (simultánea con A2)',
    'professional', 5,
    40.0, 20.0, 0,
    'A4',
    (SELECT id FROM branches WHERE slug = 'conductores-chillan'),
    true
  ),
  (
    'conv_a3',
    'Convalidación A3 (simultánea con A5)',
    'professional', 5,
    40.0, 20.0, 0,
    'A3',
    (SELECT id FROM branches WHERE slug = 'conductores-chillan'),
    true
  )
ON CONFLICT (code) DO UPDATE SET
  name             = EXCLUDED.name,
  is_convalidation = true;

COMMENT ON TABLE courses IS
  'Catálogo de cursos ofrecidos por sede: Clase B y Profesional (RF-012). '
  'Los cursos con is_convalidation = true (conv_a4, conv_a3) son contenedores '
  'de sesiones para convalidaciones simultáneas; no tienen enrollments propios.';
