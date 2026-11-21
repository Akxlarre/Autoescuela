-- ============================================================================
-- Prueba de BD — fix-506-m: encuestas de egreso solo para admin y secretaria; la limpieza de la
-- inscripción online vuelve a cancelar las matrículas pending_payment con el pago vencido
-- ============================================================================
-- Migraciones: 20261120121000_fix506_student_surveys_solo_staff.sql y
--              20261120130000_fix506_cancelar_pending_payment_vencidas.sql.
-- Crea sus propios datos (usuarios con uid inventado, un alumno, dos matrículas, una encuesta):
-- corre igual en DEV y en una BD local creada desde las migraciones. Todo dentro de una
-- transacción que termina en RAISE: no deja cambios.
--   npx supabase db query --linked -f supabase/tests/rls/fix-506-m-student-surveys-y-pending-payment.sql
-- El resultado sale en el mensaje del error final ("RESULT: …"); "FALLA" = ❌.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE t506 (k text PRIMARY KEY, id int, uid uuid) ON COMMIT DROP;
GRANT SELECT ON t506 TO authenticated;

DO $fx$
DECLARE
  v_branch int := (SELECT min(id) FROM public.branches);
  v_course int := (SELECT min(id) FROM public.courses WHERE branch_id = v_branch);
  v_role   text;
  v_uid    uuid;
  v_user   int;
  v_student int;
  v_e1     int;
  v_e2     int;
BEGIN
  -- Un usuario por rol, con uid inventado (auth.uid() sale del JWT que se simula abajo).
  FOREACH v_role IN ARRAY ARRAY['admin', 'secretary', 'student', 'instructor'] LOOP
    v_uid := gen_random_uuid();
    INSERT INTO public.users (supabase_uid, rut, first_names, paternal_last_name, email, role_id,
                              branch_id, active, first_login)
    VALUES (v_uid, 'fix506-' || v_role, 'Prueba fix-506', v_role, 'fix506-' || v_role || '@prueba.invalid',
            (SELECT id FROM public.roles WHERE name = v_role), v_branch, true, false)
    RETURNING id INTO v_user;
    INSERT INTO t506 VALUES (v_role, v_user, v_uid);
  END LOOP;

  INSERT INTO public.students (user_id, birth_date)
  VALUES ((SELECT id FROM t506 WHERE k = 'student'), '2000-01-01')
  RETURNING id INTO v_student;

  -- e1: checkout con el pago vencido (se cancela). e2: checkout todavía en curso (se queda).
  INSERT INTO public.enrollments (student_id, course_id, branch_id, status)
  VALUES (v_student, v_course, v_branch, 'pending_payment') RETURNING id INTO v_e1;
  INSERT INTO public.enrollments (student_id, course_id, branch_id, status)
  VALUES (v_student, v_course, v_branch, 'pending_payment') RETURNING id INTO v_e2;

  INSERT INTO public.payment_attempts (session_token, status, enrollment_id, expires_at)
  VALUES ('fix506-vencido', 'pending', v_e1, now() - interval '1 minute'),
         ('fix506-vigente', 'pending', v_e2, now() + interval '1 hour');

  INSERT INTO public.student_surveys (enrollment_id, satisfaction_rating, comments)
  VALUES (v_e1, 5, 'Prueba fix-506');

  INSERT INTO t506 VALUES ('e1', v_e1, NULL), ('e2', v_e2, NULL);
END $fx$;

DO $test$
DECLARE
  r     text := '';
  n     int;
  v_e1  int := (SELECT id FROM t506 WHERE k = 'e1');
  v_e2  int := (SELECT id FROM t506 WHERE k = 'e2');
  v_uid uuid;
  v_role text;
BEGIN
  -- 1-2. La limpieza (la corre el cron como dueño) cancela solo el checkout vencido.
  PERFORM public.cleanup_expired_public_enrollment();
  r := r || '1 pago vencido -> cancelled: '
         || CASE WHEN (SELECT status FROM public.enrollments WHERE id = v_e1) = 'cancelled'
                 THEN 'ok' ELSE 'FALLA' END || ' | ';
  r := r || '2 pago vigente sigue pending_payment: '
         || CASE WHEN (SELECT status FROM public.enrollments WHERE id = v_e2) = 'pending_payment'
                 THEN 'ok' ELSE 'FALLA' END || ' | ';

  -- 3-6. Quién lee la encuesta de e1 (como authenticated, con el JWT de cada rol).
  FOREACH v_role IN ARRAY ARRAY['admin', 'secretary', 'student', 'instructor'] LOOP
    v_uid := (SELECT uid FROM t506 WHERE k = v_role);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
    SET LOCAL role authenticated;
    SELECT count(*) INTO n FROM public.student_surveys WHERE enrollment_id = v_e1;
    RESET role;
    r := r || CASE v_role WHEN 'admin' THEN '3' WHEN 'secretary' THEN '4'
                          WHEN 'student' THEN '5' ELSE '6' END
           || ' ' || v_role || ' lee encuestas: '
           || CASE WHEN (v_role IN ('admin', 'secretary')) = (n = 1) THEN 'ok' ELSE 'FALLA' END
           || ' | ';
  END LOOP;

  -- 7. Un usuario con sesión no puede ejecutar la limpieza (permiso de fix-191).
  SET LOCAL role authenticated;
  BEGIN
    PERFORM public.cleanup_expired_public_enrollment();
    r := r || '7 authenticated ejecuta la limpieza: FALLA';
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || '7 authenticated ejecuta la limpieza: ok';
  END;
  RESET role;

  RAISE EXCEPTION 'RESULT: %', r;
END $test$;

ROLLBACK;
