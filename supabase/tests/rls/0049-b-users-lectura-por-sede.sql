-- ============================================================================
-- Prueba de BD — spec 0049-b: la secretaria solo lee los usuarios que necesita para su sede
-- ============================================================================
-- ACs en specs/specs/0049-b-rls-users-lectura-por-sede/spec.md (AC1, AC2, AC3, AC6).
-- TODO corre en un sub-bloque que SIEMPRE aborta (ZZ001): si la migración aún no está aplicada, la
-- aplica ahí adentro (función + política) y la deshace al final. No deja cambios.
-- Correr como postgres. Resultado en la tabla temporal r049 (último SELECT); "FALLA" = ❌.
-- Datos de producción usados (2026-10-08): secretaria@test.com (sede 1), secretaria2@test.com
-- (sede 2), secretaria.multisede@test.com (grant), admin@test.com; alumno 3121 (solo sede 1);
-- alumno 119 (usuario sede 2, matrícula sede 1); instructor 223 (sede 1, sin clases en sede 2).
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r049;
CREATE TEMP TABLE r049 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_sec1 uuid; v_sec2 uuid; v_multi uuid; v_admin uuid;
  v_inst_user int; v_sec1_id int;
  v_total int;
  v_s2_alumno_s1 int; v_s2_inst int; v_s2_sec1 int; v_s2_inst_ambas int; v_s1_cruce int;
  v_s2_total_antes int; v_s2_total_despues int; v_multi_total int; v_admin_total int;
  v_t0 timestamptz; v_ms_antes numeric; v_ms_despues numeric; v_n int;
  v_ag_antes numeric; v_ag_despues numeric;
  i int;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;
  SELECT supabase_uid INTO v_sec1 FROM public.users WHERE email = 'secretaria@test.com';
  SELECT supabase_uid, id INTO v_sec2, v_sec1_id FROM public.users WHERE email = 'secretaria2@test.com';
  SELECT id INTO v_sec1_id FROM public.users WHERE email = 'secretaria@test.com';
  SELECT supabase_uid INTO v_multi FROM public.users WHERE email = 'secretaria.multisede@test.com';
  SELECT supabase_uid INTO v_admin FROM public.users WHERE email = 'admin@test.com';
  SELECT user_id INTO v_inst_user FROM public.instructors WHERE id = 223;
  SELECT count(*) INTO v_total FROM public.users;

  BEGIN
    -- ── Antes: política vigente, secretaria2 ────────────────────────────────
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_s2_total_antes FROM public.users;
    v_t0 := clock_timestamp();
    FOR i IN 1..5 LOOP
      SELECT count(*) INTO v_n FROM public.enrollments e
        JOIN public.students s ON s.id = e.student_id JOIN public.users u ON u.id = s.user_id;
    END LOOP;
    v_ms_antes := extract(epoch FROM clock_timestamp() - v_t0) * 1000 / 5;
    v_t0 := clock_timestamp();
    FOR i IN 1..3 LOOP
      SELECT count(*) INTO v_n FROM public.v_class_b_schedule_availability
       WHERE slot_start >= now() AND slot_start < now() + interval '7 days';
    END LOOP;
    v_ag_antes := extract(epoch FROM clock_timestamp() - v_t0) * 1000 / 3;
    RESET ROLE;

    -- ── Aplicar la migración dentro del bloque (si ya está aplicada, es idempotente) ──
    EXECUTE $m$
      CREATE OR REPLACE FUNCTION public.secretary_extra_visible_user_ids()
      RETURNS SETOF integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $f$
        SELECT u.id FROM public.users u JOIN public.roles r ON r.id = u.role_id
         WHERE r.name IN ('admin', 'secretary')
        UNION SELECT i.user_id FROM public.instructors i WHERE i.both_branches
        UNION SELECT i.user_id FROM public.class_b_sessions cb
                JOIN public.enrollments e ON e.id = cb.enrollment_id
                JOIN public.instructors i ON i.id = cb.instructor_id
               WHERE e.branch_id = public.auth_user_branch_id()
        UNION SELECT s.user_id FROM public.enrollments e JOIN public.students s ON s.id = e.student_id
               WHERE e.branch_id = public.auth_user_branch_id()
        UNION SELECT s.user_id FROM public.standalone_course_enrollments sce
                JOIN public.standalone_courses sc ON sc.id = sce.standalone_course_id
                JOIN public.students s ON s.id = sce.student_id
               WHERE sc.branch_id = public.auth_user_branch_id()
        UNION SELECT p.temp_user_id FROM public.professional_pre_registrations p
               WHERE p.branch_id = public.auth_user_branch_id() AND p.temp_user_id IS NOT NULL;
      $f$
    $m$;
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.secretary_extra_visible_user_ids() TO authenticated';
    EXECUTE 'DROP POLICY IF EXISTS select_users ON public.users';
    EXECUTE $m$
      CREATE POLICY select_users ON public.users FOR SELECT USING (
        ((SELECT public.auth_user_role()) = 'admin')
        OR ((SELECT public.auth_user_role()) = 'secretary' AND (
              (SELECT public.auth_can_access_both_branches())
           OR branch_id IS NULL
           OR branch_id = (SELECT public.auth_user_branch_id())
           OR id = (SELECT public.auth_user_id())
           OR id IN (SELECT public.secretary_extra_visible_user_ids())))
        OR ((SELECT public.auth_user_role()) = ANY (ARRAY['instructor', 'student']) AND id = (SELECT public.auth_user_id())))
    $m$;

    -- ── Después: secretaria2 (sede 2) ───────────────────────────────────────
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec2, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_s2_total_despues FROM public.users;
    SELECT count(*) INTO v_s2_alumno_s1 FROM public.users WHERE id = 3121;
    SELECT count(*) INTO v_s2_inst FROM public.users WHERE id = v_inst_user;
    SELECT count(*) INTO v_s2_sec1 FROM public.users WHERE id = v_sec1_id;
    v_t0 := clock_timestamp();
    FOR i IN 1..5 LOOP
      SELECT count(*) INTO v_n FROM public.enrollments e
        JOIN public.students s ON s.id = e.student_id JOIN public.users u ON u.id = s.user_id;
    END LOOP;
    v_ms_despues := extract(epoch FROM clock_timestamp() - v_t0) * 1000 / 5;
    v_t0 := clock_timestamp();
    FOR i IN 1..3 LOOP
      SELECT count(*) INTO v_n FROM public.v_class_b_schedule_availability
       WHERE slot_start >= now() AND slot_start < now() + interval '7 days';
    END LOOP;
    v_ag_despues := extract(epoch FROM clock_timestamp() - v_t0) * 1000 / 3;
    RESET ROLE;

    -- Instructor 223 pasa a "Ambas" → secretaria2 lo ve.
    UPDATE public.instructors SET both_branches = true WHERE id = 223;
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_s2_inst_ambas FROM public.users WHERE id = v_inst_user;
    RESET ROLE;

    -- ── secretaria@test.com (sede 1): alumno 119, usuario de sede 2 con matrícula en sede 1 ──
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec1, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_s1_cruce FROM public.users WHERE id = 119;
    RESET ROLE;

    -- ── multisede y admin: ven todo ─────────────────────────────────────────
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_multi, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_multi_total FROM public.users;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_admin_total FROM public.users;
    RESET ROLE;

    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN
    NULL; -- deshace migración y datos de prueba; las variables sobreviven
  END;

  INSERT INTO r049 VALUES
    ('AC1 secretaria2 no ve al alumno solo de sede 1 (3121)', '0', v_s2_alumno_s1::text,
     CASE WHEN v_s2_alumno_s1 = 0 THEN 'ok' ELSE 'FALLA' END),
    ('AC1 secretaria2 no ve al instructor de sede 1 sin relación', '0', v_s2_inst::text,
     CASE WHEN v_s2_inst = 0 THEN 'ok' ELSE 'FALLA' END),
    ('AC2 secretaria2 ve al personal de otra sede', '1', v_s2_sec1::text,
     CASE WHEN v_s2_sec1 = 1 THEN 'ok' ELSE 'FALLA' END),
    ('AC2 secretaria2 ve al instructor si es "Ambas"', '1', v_s2_inst_ambas::text,
     CASE WHEN v_s2_inst_ambas = 1 THEN 'ok' ELSE 'FALLA' END),
    ('AC2 secretaria (sede 1) ve al alumno de usuario sede 2 con matrícula sede 1 (119)', '1', v_s1_cruce::text,
     CASE WHEN v_s1_cruce = 1 THEN 'ok' ELSE 'FALLA' END),
    ('AC3 multisede ve todo', v_total::text, v_multi_total::text,
     CASE WHEN v_multi_total = v_total THEN 'ok' ELSE 'FALLA' END),
    ('AC3 admin ve todo', v_total::text, v_admin_total::text,
     CASE WHEN v_admin_total = v_total THEN 'ok' ELSE 'FALLA' END),
    ('info secretaria2: usuarios visibles antes → después', v_s2_total_antes::text, v_s2_total_despues::text,
     CASE WHEN v_s2_total_despues < v_s2_total_antes THEN 'ok' ELSE 'FALLA' END),
    ('AC6 secretaria2 alumnos+usuarios (ms/consulta) antes → después (≤ +20 % o ≤ 5 ms)',
     round(v_ms_antes, 1)::text, round(v_ms_despues, 1)::text,
     CASE WHEN v_ms_despues <= greatest(v_ms_antes * 1.2, v_ms_antes + 5) THEN 'ok' ELSE 'FALLA' END),
    ('AC6 secretaria2 Agenda 7 días (ms/consulta) antes → después (≤ +20 % o ≤ 5 ms)',
     round(v_ag_antes, 1)::text, round(v_ag_despues, 1)::text,
     CASE WHEN v_ag_despues <= greatest(v_ag_antes * 1.2, v_ag_antes + 5) THEN 'ok' ELSE 'FALLA' END);
END $test$;

SELECT * FROM r049 ORDER BY caso;
