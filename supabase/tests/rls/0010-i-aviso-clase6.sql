-- ============================================================================
-- Prueba de BD — spec 0010-i (AC7): aviso tras la clase 6 para toda matrícula con deuda
-- Migración: 20261013130000_spec0010i_aviso_clase6_toda_deuda.sql.
-- Todo corre en un sub-bloque que SIEMPRE aborta (ZZ001): no deja clases, saldos ni avisos.
-- Correr como postgres en el SQL Editor. Resultado: último SELECT; "❌" = falla.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r0010b;
CREATE TEMP TABLE r0010b (n int, caso text, esperado text, obtenido text);

DO $test$
DECLARE
  v_s6        int;
  v_e6        int;
  v_branch    int;
  v_alumno    int;
  v_staff     int;
  v_alumno_n  int;
  v_staff_n   int;
  v_err       text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  -- Clase 6 de una matrícula Clase B normal (no Refuerzo), con sede.
  SELECT s.id, e.id, e.branch_id, st.user_id INTO v_s6, v_e6, v_branch, v_alumno
  FROM public.class_b_sessions s
  JOIN public.enrollments e ON e.id = s.enrollment_id
  JOIN public.students st ON st.id = e.student_id
  JOIN public.courses c ON c.id = e.course_id
  WHERE s.class_number = 6 AND e.branch_id IS NOT NULL AND c.is_reinforcement IS NOT TRUE
  ORDER BY s.id DESC LIMIT 1;
  IF v_s6 IS NULL THEN RAISE EXCEPTION 'Falta una clase 6 de Clase B con sede'; END IF;

  SELECT count(*) INTO v_staff FROM public.users u JOIN public.roles r ON r.id = u.role_id
  WHERE u.active = true AND (r.name = 'admin' OR (r.name = 'secretary' AND u.branch_id = v_branch));

  BEGIN
    -- Deuda con modalidad "total" (antes no avisaba: solo 'partial').
    UPDATE public.enrollments SET pending_balance = 180000, payment_mode = 'total' WHERE id = v_e6;
    UPDATE public.class_b_sessions SET status = 'scheduled' WHERE id = v_s6;
    DELETE FROM public.notifications
      WHERE reference_id = v_e6 AND subject IN ('Pago pendiente', 'Cobrar antes de la clase 7');

    v_err := NULL;
    BEGIN
      UPDATE public.class_b_sessions SET status = 'completed' WHERE id = v_s6;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;

    SELECT count(*) INTO v_alumno_n FROM public.notifications
      WHERE reference_id = v_e6 AND subject = 'Pago pendiente' AND recipient_id = v_alumno;
    SELECT count(*) INTO v_staff_n FROM public.notifications
      WHERE reference_id = v_e6 AND subject = 'Cobrar antes de la clase 7';
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  INSERT INTO r0010b VALUES
    (1, 'Completar la clase 6 no falla', 'sin error', COALESCE(v_err, 'sin error')),
    (2, 'AC7 aviso al alumno (modalidad total con deuda)', '1', v_alumno_n::text),
    (3, 'AC7 un aviso por secretaria de la sede + admin', v_staff::text, v_staff_n::text);
END;
$test$;

SELECT n, caso, esperado, obtenido,
       CASE WHEN obtenido IS NOT DISTINCT FROM esperado THEN '✅' ELSE '❌' END AS resultado
FROM r0010b
ORDER BY n;
