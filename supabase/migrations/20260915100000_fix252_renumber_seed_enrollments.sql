-- ============================================================================
-- Migración: Renumerar matrículas de seed con number='SEED-NNNNNN' corrupto
--
-- Problema (fix-252-m): un script de seed local (no commiteado al repo) insertó
-- ~100 matrículas de prueba con enrollments.number = 'SEED-NNNNNN' en vez del
-- formato numérico ('0001', '0002', ...) que espera get_next_enrollment_number().
-- Cuando esa fila queda como la de mayor id dentro de su grupo
-- (branch_id × license_group), la siguiente matrícula real de ese grupo falla
-- con 22P02 ('invalid input syntax for type integer') al intentar
-- v_last_number::INT.
--
-- Decisión del equipo: estas filas son datos de prueba que se necesitan y NO
-- se eliminan — se renumeran con el formato correcto.
--
-- Solución:
--   1. Renumerar las filas 'SEED-%' con el siguiente correlativo válido de su
--      grupo, preservando su orden relativo de creación (id ASC).
--   2. Blindar get_next_enrollment_number() para ignorar cualquier number que
--      no sea puramente numérico, evitando que datos sucios futuros repitan
--      este incidente.
--
-- Idempotente: si se corre dos veces, el segundo run no encuentra filas
-- 'SEED-%' y no hace nada.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Renumerar filas 'SEED-%' por grupo (branch_id, license_group)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  grp RECORD;
  dirty RECORD;
  v_next_seq INT;
  v_new_number TEXT;
BEGIN
  FOR grp IN
    SELECT DISTINCT branch_id, license_group
    FROM enrollments
    WHERE number LIKE 'SEED-%'
  LOOP
    -- Base: máximo número numérico válido ya existente en el grupo
    SELECT COALESCE(MAX(number::INT), 0)
      INTO v_next_seq
    FROM enrollments
    WHERE branch_id = grp.branch_id
      AND license_group = grp.license_group
      AND number ~ '^[0-9]+$';

    -- Asignar correlativo a cada fila sucia, en orden de creación
    FOR dirty IN
      SELECT id
      FROM enrollments
      WHERE branch_id = grp.branch_id
        AND license_group = grp.license_group
        AND number LIKE 'SEED-%'
      ORDER BY id ASC
    LOOP
      v_next_seq := v_next_seq + 1;
      v_new_number := lpad(
        v_next_seq::TEXT,
        CASE WHEN v_next_seq >= 10000 THEN 5 ELSE 4 END,
        '0'
      );

      UPDATE enrollments
      SET number = v_new_number
      WHERE id = dirty.id;
    END LOOP;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Blindar get_next_enrollment_number(): ignorar number no numérico
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
    AND e.number ~ '^[0-9]+$'              -- fix-252-m: ignora numeración corrupta/no numérica
    AND (c.license_class = 'B') = v_is_class_b
    AND c.branch_id = v_branch_id          -- filtro por sede
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
  'Genera el siguiente número correlativo de matrícula por (branch_id × tipo de licencia). '
  'fix-252-m: ignora filas con number no numérico (datos sucios) al buscar el último número, '
  'para que un dato corrupto nunca vuelva a romper el cast a INT.';
