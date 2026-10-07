-- ============================================================================
-- SCRIPT MANUAL — borra todo lo creado por seed_d6_volumen.sql (dato D6, fix-190-b)
-- ============================================================================
-- Identifica las filas por sus marcas (matrícula 'D6-NNNN' + usuario 'D6' con email @e2e.test)
-- y las borra de hijos a padres. No toca nada más.
-- ============================================================================

DO $$
DECLARE
  v_enr  INT[];
  v_stu  INT[];
  v_usr  INT[];
BEGIN
  SELECT array_agg(e.id), array_agg(DISTINCT e.student_id)
    INTO v_enr, v_stu
    FROM public.enrollments e
    JOIN public.students s ON s.id = e.student_id
    JOIN public.users u ON u.id = s.user_id
   WHERE e.number LIKE 'D6-%' AND u.first_names = 'D6' AND u.email LIKE 'd6.%@e2e.test';

  IF v_enr IS NULL THEN
    RAISE NOTICE 'No hay datos D6.';
    RETURN;
  END IF;

  SELECT array_agg(user_id) INTO v_usr FROM public.students WHERE id = ANY (v_stu);

  DELETE FROM public.class_b_sessions  WHERE enrollment_id = ANY (v_enr);
  DELETE FROM public.student_documents WHERE enrollment_id = ANY (v_enr);
  DELETE FROM public.payments          WHERE enrollment_id = ANY (v_enr);
  DELETE FROM public.enrollments       WHERE id = ANY (v_enr);
  DELETE FROM public.students          WHERE id = ANY (v_stu);
  DELETE FROM public.users             WHERE id = ANY (v_usr);

  RAISE NOTICE 'D6 borrado: % matrículas, % alumnos.', array_length(v_enr, 1), array_length(v_stu, 1);
END $$;
