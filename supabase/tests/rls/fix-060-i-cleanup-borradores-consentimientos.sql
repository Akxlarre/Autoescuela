-- ============================================================================
-- fix-060-i — cleanup_expired_drafts() con un borrador vencido que tiene consentimientos.
-- Arma un borrador vencido con consentimiento (una matrícula activa con clases agendadas, pasada a
-- draft) y otro sin consentimiento (creado acá), corre la limpieza y revisa AC-F1..AC-F3.
-- Todo corre en un sub-bloque que SIEMPRE aborta (ZZ001): no deja cambios. Correr como postgres.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r060;
CREATE TEMP TABLE r060 (n int, caso text, esperado text, obtenido text);

DO $test$
DECLARE
  v_con int;  v_user int;  v_branch int;  v_ses int;  v_stu_con int;
  v_otro_stu int;  v_otro_course int;  v_otro_branch int;
  v_sin int;
  v_pay int;  v_pay_after int;
  v_status text;  v_expires timestamptz;  v_ses_after int;  v_cons int;  v_cons_antes int;  v_sin_existe boolean;
  v_err text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  -- Matrícula activa con clases agendadas, ninguna hecha todavía (hará de borrador con consentimiento)
  SELECT e.id, e.student_id, s.user_id, e.branch_id, count(cs.id)
    INTO v_con, v_stu_con, v_user, v_branch, v_ses
  FROM public.enrollments e
  JOIN public.students s ON s.id = e.student_id
  JOIN public.class_b_sessions cs ON cs.enrollment_id = e.id
  WHERE e.status = 'active'
  GROUP BY e.id, e.student_id, s.user_id, e.branch_id
  HAVING bool_and(cs.status = 'scheduled')
  ORDER BY e.id DESC LIMIT 1;
  IF v_con IS NULL THEN
    RAISE EXCEPTION 'Falta una matrícula activa con clases agendadas y ninguna hecha';
  END IF;

  -- Otro alumno con una matrícula activa: se le crea un borrador sin consentimientos
  SELECT e.student_id, e.course_id, e.branch_id INTO v_otro_stu, v_otro_course, v_otro_branch
  FROM public.enrollments e
  WHERE e.status = 'active' AND e.student_id <> v_stu_con
  ORDER BY e.id DESC LIMIT 1;
  IF v_otro_stu IS NULL THEN
    RAISE EXCEPTION 'Falta otro alumno con matrícula activa';
  END IF;

  BEGIN
    INSERT INTO public.enrollments (student_id, course_id, branch_id, base_price, discount, total_paid,
      status, expires_at, docs_complete, contract_accepted, certificate_enabled, registration_channel)
    VALUES (v_otro_stu, v_otro_course, v_otro_branch, 0, 0, 0,
      'draft', NOW() - interval '1 hour', false, false, false, 'in_person')
    RETURNING id INTO v_sin;

    UPDATE public.enrollments SET status = 'draft', expires_at = NOW() - interval '1 hour'
    WHERE id = v_con;
    INSERT INTO public.consents (user_id, enrollment_id, branch_id, consent_type, granted, policy_version, source)
    VALUES (v_user, v_con, v_branch, 'matricula_datos', true, 'test-fix-060', 'secretaria');
    SELECT count(*) INTO v_pay FROM public.payments WHERE enrollment_id = v_con;
    SELECT count(*) INTO v_cons_antes FROM public.consents WHERE enrollment_id = v_con;

    PERFORM public.cleanup_expired_drafts();

    SELECT status, expires_at INTO v_status, v_expires FROM public.enrollments WHERE id = v_con;
    SELECT count(*) INTO v_ses_after FROM public.class_b_sessions WHERE enrollment_id = v_con;
    SELECT count(*) INTO v_cons FROM public.consents WHERE enrollment_id = v_con;
    SELECT count(*) INTO v_pay_after FROM public.payments WHERE enrollment_id = v_con;
    v_sin_existe := EXISTS (SELECT 1 FROM public.enrollments WHERE id = v_sin);
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
            WHEN OTHERS THEN v_err := 'error: ' || SQLERRM;
  END;

  INSERT INTO r060 VALUES
    (1, 'AC-F1 borrador vencido con consentimiento → queda cancelado', 'cancelled',
        COALESCE(v_err, v_status, 'borrado')),
    (2, 'AC-F1 sus ' || v_ses || ' clases se borran (libera la agenda)', '0',
        COALESCE(v_err, v_ses_after::text)),
    -- La matrícula elegida puede traer consentimientos reales: se esperan todos, más el de prueba.
    (3, 'AC-F1 sus consentimientos siguen vinculados', v_cons_antes::text, COALESCE(v_err, v_cons::text)),
    (4, 'AC-F3 sus pagos no se tocan', v_pay::text, COALESCE(v_err, v_pay_after::text)),
    (5, 'AC-F2 borrador sin consentimiento en la misma corrida → borrado', 'borrado',
        COALESCE(v_err, CASE WHEN v_sin_existe THEN 'sigue ahí' ELSE 'borrado' END)),
    (6, 'La cancelada ya no tiene fecha de vencimiento', 'sin fecha',
        COALESCE(v_err, CASE WHEN v_expires IS NULL THEN 'sin fecha' ELSE v_expires::text END)),
    (7, 'No deja datos: consentimientos de prueba', '0',
        (SELECT count(*)::text FROM public.consents WHERE policy_version = 'test-fix-060')),
    (8, 'Hoy: borradores con consentimientos', 'informativo',
        (SELECT count(*)::text FROM public.enrollments e
         WHERE e.status = 'draft' AND EXISTS (SELECT 1 FROM public.consents c WHERE c.enrollment_id = e.id)));
END
$test$;

SELECT * FROM r060 ORDER BY n;
