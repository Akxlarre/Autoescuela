-- ============================================================================
-- Migración: Cursos Clase B para Conductores Chillán + numeración por sede
--
-- Problema 1: Conductores Chillán (branch_id=2) no tiene cursos Clase B,
--   por lo que la vista v_class_b_schedule_availability no genera slots para
--   sus instructores y no es posible matricular alumnos Clase B ahí.
--
-- Problema 2: get_next_enrollment_number usa un contador global por tipo de
--   licencia, compartido entre ambas sedes. Los números deben ser secuencias
--   independientes: branch 1 tiene su 0001..N y branch 2 su propio 0001..N.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Cursos Clase B para Conductores Chillán (branch_id = 2)
-- ─────────────────────────────────────────────────────────────────────────────
-- Mismo tipo y configuración que los de Autoescuela Chillán, pero con branch_id
-- apuntando a Conductores Chillán. Los códigos deben ser únicos en la tabla.
-- Convención: prefijo 'cc_' (Conductores Chillán).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO courses (
  code,
  name,
  type,
  duration_weeks,
  practical_hours,
  theory_hours,
  base_price,
  license_class,
  branch_id,
  schedule_days,
  schedule_blocks
)
SELECT
  new_courses.code,
  new_courses.name,
  'class_b',
  8,
  9.0,
  12.0,
  180000,
  'B',
  (SELECT id FROM branches WHERE slug = 'conductores-chillan'),
  '{1,2,3,4,5}'::INT[],
  '[{"from":"09:00","to":"13:00"},{"from":"15:00","to":"19:00"}]'::JSONB
FROM (VALUES
  ('cc_class_b',       'Clase B'),
  ('cc_class_b_sence', 'Clase B SENCE')
) AS new_courses(code, name)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Corregir get_next_enrollment_number para separar contadores por sede
-- ─────────────────────────────────────────────────────────────────────────────
-- Antes: buscaba el último número entre TODAS las matrículas del mismo tipo
--        de licencia, sin importar la sede.
-- Ahora: filtra además por branch_id del curso, para que cada sede tenga su
--        propia secuencia independiente (0001, 0002, ...).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_next_enrollment_number(p_course_id INT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_license_class TEXT;
  v_branch_id     INT;
  v_is_class_b    BOOLEAN;
  v_last_number   TEXT;
  v_next_seq      INT;
BEGIN
  -- 1. Obtener clase de licencia y sede del curso
  SELECT license_class, branch_id
    INTO v_license_class, v_branch_id
  FROM courses
  WHERE id = p_course_id;

  IF v_license_class IS NULL THEN
    RAISE EXCEPTION 'Curso % no encontrado o sin license_class', p_course_id;
  END IF;

  v_is_class_b := (v_license_class = 'B');

  -- 2. Último número asignado para este grupo de licencia EN ESTA SEDE
  SELECT e.number INTO v_last_number
  FROM enrollments e
  JOIN courses c ON c.id = e.course_id
  WHERE e.number IS NOT NULL
    AND (c.license_class = 'B') = v_is_class_b
    AND c.branch_id = v_branch_id          -- ← filtro por sede (fix principal)
    AND e.status != 'draft'                -- los drafts sin confirmar no consumen número
  ORDER BY e.id DESC
  LIMIT 1;

  -- 3. Calcular siguiente secuencia
  IF v_last_number IS NULL THEN
    v_next_seq := 1;
  ELSE
    v_next_seq := v_last_number::INT + 1;
  END IF;

  -- 4. Formatear: 4 dígitos hasta 9999, 5 desde 10000
  RETURN lpad(
    v_next_seq::TEXT,
    CASE WHEN v_next_seq >= 10000 THEN 5 ELSE 4 END,
    '0'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_next_enrollment_number(INT) TO authenticated;

COMMENT ON FUNCTION get_next_enrollment_number(INT) IS
  'Devuelve el siguiente número de matrícula correlativo. '
  'La secuencia es independiente por (sede × tipo_licencia): '
  'Clase B de Autoescuela Chillán, Clase B de Conductores Chillán y '
  'Profesional tienen contadores separados. Los drafts sin confirmar '
  'no consumen número.';
