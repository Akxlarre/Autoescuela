-- ============================================================
-- Migration: Numeración separada por tipo de licencia
-- Los números de matrícula son secuencias independientes:
--   · Clase B (license_class = 'B')  → 0001, 0002, ...
--   · Profesional (A2, A3, A4, etc.) → 0001, 0002, ...
-- ============================================================

CREATE OR REPLACE FUNCTION get_next_enrollment_number(p_course_id INT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_license_class TEXT;
  v_is_class_b    BOOLEAN;
  v_last_number   TEXT;
  v_next_seq      INT;
BEGIN
  -- 1. Obtener clase de licencia del curso
  SELECT license_class INTO v_license_class
  FROM courses
  WHERE id = p_course_id;

  IF v_license_class IS NULL THEN
    RAISE EXCEPTION 'Curso % no encontrado o sin license_class', p_course_id;
  END IF;

  v_is_class_b := (v_license_class = 'B');

  -- 2. Obtener el último número asignado para este grupo de licencia
  SELECT e.number INTO v_last_number
  FROM enrollments e
  JOIN courses c ON c.id = e.course_id
  WHERE e.number IS NOT NULL
    AND (c.license_class = 'B') = v_is_class_b
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

-- Permitir ejecución a usuarios autenticados (secretaria / admin)
GRANT EXECUTE ON FUNCTION get_next_enrollment_number(INT) TO authenticated;
