-- ============================================================================
-- Eliminar columna student_id redundante de tablas que ya tienen enrollment_id
--
-- Razón: enrollments.student_id hace que student_id en tablas hijas sea siempre
-- derivable via JOIN. Tenerla duplicada crea riesgo de inconsistencia sin valor.
--
-- Tablas afectadas:
--   - class_b_exam_scores
--   - class_b_exam_attempts
--   - professional_theory_attendance
--   - professional_practice_attendance
--   - digital_contracts
--
-- Cambios colaterales:
--   - UNIQUE constraints que usaban student_id se reemplazan por enrollment_id
--   - Políticas RLS que filtraban por student_id se actualizan con EXISTS subquery
--   - Vista v_professional_attendance recreada: joins actualizados de student_id a enrollment_id
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. RECREAR v_professional_attendance SIN dependencia en student_id
--
-- Los joins originales usaban pta.student_id = s.id / ppa.student_id = s.id.
-- Como enrollment_id ya está en ambas tablas y m.id es el enrollment,
-- se reemplazan por pta.enrollment_id = m.id / ppa.enrollment_id = m.id.
-- El campo s.id AS student_id del SELECT no cambia: viene del JOIN a students.
-- ============================================================================
CREATE OR REPLACE VIEW v_professional_attendance AS
SELECT
  m.id AS enrollment_id,
  s.id AS student_id,
  cc.promotion_id,
  cc.course_id,
  ROUND(
    COUNT(pta.id) FILTER (WHERE pta.status = 'present') * 100.0 /
    NULLIF(COUNT(pta.id), 0)
  ) AS pct_theory,
  ROUND(
    COUNT(ppa.id) FILTER (WHERE ppa.status = 'present') * 100.0 /
    NULLIF(COUNT(ppa.id), 0)
  ) AS pct_practice,
  CASE
    WHEN COUNT(pta.id) FILTER (WHERE pta.status = 'present') * 100.0 /
         NULLIF(COUNT(pta.id), 0) >= 75
     AND COUNT(ppa.id) FILTER (WHERE ppa.status = 'present') * 100.0 /
         NULLIF(COUNT(ppa.id), 0) = 100 THEN 'green'
    WHEN COUNT(pta.id) FILTER (WHERE pta.status = 'present') * 100.0 /
         NULLIF(COUNT(pta.id), 0) >= 60 THEN 'yellow'
    ELSE 'red'
  END AS attendance_flag
FROM enrollments m
JOIN courses c ON c.id = m.course_id
JOIN students s ON s.id = m.student_id
JOIN promotion_courses cc ON cc.id = m.promotion_course_id
LEFT JOIN professional_theory_sessions pts ON pts.promotion_course_id = m.promotion_course_id
LEFT JOIN professional_theory_attendance pta
  ON pta.theory_session_prof_id = pts.id AND pta.enrollment_id = m.id
LEFT JOIN professional_practice_sessions pps ON pps.promotion_course_id = m.promotion_course_id
LEFT JOIN professional_practice_attendance ppa
  ON ppa.session_id = pps.id AND ppa.enrollment_id = m.id
WHERE c.type = 'professional'
  AND m.promotion_course_id IS NOT NULL
GROUP BY m.id, s.id, cc.promotion_id, cc.course_id;

ALTER VIEW v_professional_attendance SET (security_invoker = true);

-- ============================================================================
-- 1. PROFESSIONAL_THEORY_ATTENDANCE
-- ============================================================================

-- Nuevo UNIQUE: una matrícula por sesión teórica
-- (reemplaza el antiguo UNIQUE(theory_session_prof_id, student_id))
ALTER TABLE professional_theory_attendance
  ADD CONSTRAINT uq_prof_theory_att_session_enrollment
  UNIQUE (theory_session_prof_id, enrollment_id);

-- Actualizar RLS: alumno ve sus propios registros via enrollment
DROP POLICY IF EXISTS select_prof_theory_attendance ON professional_theory_attendance;
CREATE POLICY select_prof_theory_attendance ON professional_theory_attendance
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (
      auth_user_role() = 'student'
      AND EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.id = enrollment_id
          AND e.student_id = auth_student_id()
      )
    )
  );

-- DROP COLUMN elimina automáticamente el UNIQUE antiguo (theory_session_prof_id, student_id)
-- y la FK a students(id)
ALTER TABLE professional_theory_attendance DROP COLUMN student_id;


-- ============================================================================
-- 2. PROFESSIONAL_PRACTICE_ATTENDANCE
-- ============================================================================

-- Nuevo UNIQUE: una matrícula por sesión práctica
-- (reemplaza el antiguo UNIQUE(session_id, student_id))
ALTER TABLE professional_practice_attendance
  ADD CONSTRAINT uq_prof_practice_att_session_enrollment
  UNIQUE (session_id, enrollment_id);

-- Actualizar RLS
DROP POLICY IF EXISTS select_prof_practice_attendance ON professional_practice_attendance;
CREATE POLICY select_prof_practice_attendance ON professional_practice_attendance
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (
      auth_user_role() = 'student'
      AND EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.id = enrollment_id
          AND e.student_id = auth_student_id()
      )
    )
  );

ALTER TABLE professional_practice_attendance DROP COLUMN student_id;


-- ============================================================================
-- 3. CLASS_B_EXAM_SCORES
-- ============================================================================

-- Actualizar RLS (student_id solo aparecía en SELECT)
DROP POLICY IF EXISTS select_class_b_exam_scores ON class_b_exam_scores;
CREATE POLICY select_class_b_exam_scores ON class_b_exam_scores
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary', 'instructor')
    OR (
      auth_user_role() = 'student'
      AND EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.id = enrollment_id
          AND e.student_id = auth_student_id()
      )
    )
  );

ALTER TABLE class_b_exam_scores DROP COLUMN student_id;


-- ============================================================================
-- 4. CLASS_B_EXAM_ATTEMPTS
-- ============================================================================

-- student_id aparecía en SELECT y en INSERT — ambas necesitan actualización
DROP POLICY IF EXISTS select_class_b_exam_attempts ON class_b_exam_attempts;
CREATE POLICY select_class_b_exam_attempts ON class_b_exam_attempts
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (
      auth_user_role() = 'student'
      AND EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.id = enrollment_id
          AND e.student_id = auth_student_id()
      )
    )
  );

DROP POLICY IF EXISTS insert_class_b_exam_attempts ON class_b_exam_attempts;
CREATE POLICY insert_class_b_exam_attempts ON class_b_exam_attempts
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (
      auth_user_role() = 'student'
      AND EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.id = enrollment_id
          AND e.student_id = auth_student_id()
      )
    )
  );

-- La policy SELECT de class_b_exam_questions filtra por student_id de esta tabla
-- via subquery — debe actualizarse antes del DROP COLUMN
DROP POLICY IF EXISTS select_class_b_exam_questions ON class_b_exam_questions;
CREATE POLICY select_class_b_exam_questions ON class_b_exam_questions
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (
      auth_user_role() = 'student'
      AND exam_id IN (
        SELECT a.exam_id FROM class_b_exam_attempts a
        JOIN enrollments e ON e.id = a.enrollment_id
        WHERE e.student_id = auth_student_id()
          AND a.submitted_at IS NULL
      )
    )
  );

ALTER TABLE class_b_exam_attempts DROP COLUMN student_id;


-- ============================================================================
-- 5. DIGITAL_CONTRACTS
-- ============================================================================

-- v_dms_student_documents usa dc.student_id en su UNION ALL — recrear primero
CREATE OR REPLACE VIEW v_dms_student_documents AS
  SELECT
    sd.id::TEXT          AS id,
    'student_document'   AS source,
    e.student_id,
    sd.enrollment_id,
    sd.type,
    sd.file_name,
    sd.storage_url       AS file_url,
    sd.status,
    sd.uploaded_at       AS document_at,
    sd.reviewed_by       AS managed_by
  FROM student_documents sd
  JOIN enrollments e ON e.id = sd.enrollment_id

UNION ALL

  SELECT
    dc.id::TEXT          AS id,
    'digital_contract'   AS source,
    e.student_id,
    dc.enrollment_id,
    'contract'           AS type,
    dc.file_name,
    dc.file_url,
    CASE WHEN dc.file_url IS NOT NULL THEN 'approved' ELSE 'pending' END AS status,
    dc.accepted_at       AS document_at,
    NULL::INT            AS managed_by
  FROM digital_contracts dc
  JOIN enrollments e ON e.id = dc.enrollment_id
  WHERE dc.file_url IS NOT NULL;

ALTER VIEW v_dms_student_documents SET (security_invoker = true);

-- Actualizar RLS (ya tiene UNIQUE en enrollment_id, solo falta el SELECT)
DROP POLICY IF EXISTS select_digital_contracts ON digital_contracts;
CREATE POLICY select_digital_contracts ON digital_contracts
  FOR SELECT USING (
    auth_user_role() IN ('admin', 'secretary')
    OR (
      auth_user_role() = 'student'
      AND EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.id = enrollment_id
          AND e.student_id = auth_student_id()
      )
    )
  );

ALTER TABLE digital_contracts DROP COLUMN student_id;

COMMIT;
