-- ============================================================================
-- Fix: v_student_progress_b — completed_practices inflado por producto cartesiano
--
-- Problema: La vista hace LEFT JOIN class_b_sessions × LEFT JOIN class_b_theory_sessions.
-- Cuando hay N prácticas y M sesiones teóricas, el COUNT de prácticas acumula N×M.
-- Ejemplo: 12 prácticas × 4 teóricas = 48 (incorrecto).
--
-- Causa raíz: el JOIN a class_b_theory_sessions multiplica cada fila de práctica
-- por cada sesión teórica. Para el porcentaje teórico no importa porque numerador
-- y denominador se multiplican por el mismo factor. Para completed_practices sí.
--
-- Solución: COUNT(DISTINCT cb.id) en lugar de COUNT(cb.id).
-- ============================================================================

CREATE OR REPLACE VIEW v_student_progress_b AS
SELECT
  m.id AS enrollment_id,
  s.id AS student_id,
  COUNT(DISTINCT cb.id) FILTER (WHERE cb.status = 'completed')           AS completed_practices,
  ROUND(COUNT(DISTINCT cb.id) FILTER (WHERE cb.status = 'completed') / 12.0 * 100)
                                                                          AS pct_practices,
  ROUND(
    COUNT(at2.id) FILTER (WHERE at2.status = 'present') * 100.0 /
    NULLIF(COUNT(at2.id), 0)
  )                                                                       AS pct_theory_attendance,
  MAX(cb.updated_at)                                                      AS last_practice_session
FROM enrollments m
JOIN  courses c  ON c.id = m.course_id
JOIN  students s ON s.id = m.student_id
LEFT JOIN class_b_sessions cb         ON cb.enrollment_id = m.id
LEFT JOIN class_b_theory_sessions ctb ON ctb.branch_id    = m.branch_id
LEFT JOIN class_b_theory_attendance at2
       ON at2.theory_session_b_id = ctb.id
      AND at2.student_id          = s.id
WHERE c.type = 'class_b'
GROUP BY m.id, s.id;

ALTER VIEW v_student_progress_b SET (security_invoker = true);

COMMENT ON VIEW v_student_progress_b IS
  'Progreso académico alumno Clase B: prácticas completadas (DISTINCT para evitar '
  'duplicación por cross-join con sesiones teóricas) y % asistencia teórica.';
