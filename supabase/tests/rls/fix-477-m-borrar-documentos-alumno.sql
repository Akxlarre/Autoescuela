-- ============================================================================
-- Test de RLS — fix-477-m: solo el admin borra documentos de alumno (salvo un borrador)
-- ============================================================================
-- Verifica (ver specs/fixes/fix-477-m-rls-borrar-documentos-alumno-solo-admin/fix.md):
--   D1  secretaria sede 1 NO borra un documento de una matrícula activa de su sede
--   D2  secretaria sede 1 SÍ borra un documento de un borrador de su sede (wizard)
--   D3  admin borra un documento de una matrícula activa
-- Crea sus propios datos dentro de la transacción y la revierte siempre (RAISE al final).
-- Correr como postgres.
-- ============================================================================

BEGIN;

DO $test$
DECLARE
  v_fail text[] := '{}';
  v_sec  uuid;
  v_adm  uuid;
  v_student int;
  v_course  int;
  v_active  int;
  v_draft   int;
  v_n int;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Correr como postgres (current_user = %)', current_user;
  END IF;

  SELECT supabase_uid INTO v_sec FROM public.users WHERE email = 'secretaria@test.com';
  SELECT supabase_uid INTO v_adm FROM public.users WHERE email = 'admin@test.com';
  SELECT e.student_id, e.course_id INTO v_student, v_course
    FROM public.enrollments e WHERE e.branch_id = 1 LIMIT 1;

  INSERT INTO public.enrollments (number, student_id, course_id, branch_id, status, base_price, discount, total_paid)
  VALUES ('T477-A', v_student, v_course, 1, 'active', 0, 0, 0) RETURNING id INTO v_active;
  INSERT INTO public.enrollments (number, student_id, course_id, branch_id, status, base_price, discount, total_paid)
  VALUES ('T477-D', v_student, v_course, 1, 'draft', 0, 0, 0) RETURNING id INTO v_draft;

  INSERT INTO public.student_documents (enrollment_id, type, file_name, storage_url, status)
  VALUES (v_active, 'cedula_identidad', 't477.pdf', 't477/a.pdf', 'approved'),
         (v_draft,  'cedula_identidad', 't477.pdf', 't477/d.pdf', 'approved');

  -- D1 / D2: secretaria
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  WITH d AS (DELETE FROM public.student_documents WHERE enrollment_id = v_active RETURNING 1)
    SELECT count(*) INTO v_n FROM d;
  IF v_n <> 0 THEN v_fail := v_fail || format('D1: la secretaria borró %s documento(s) de una matrícula activa', v_n); END IF;
  WITH d AS (DELETE FROM public.student_documents WHERE enrollment_id = v_draft RETURNING 1)
    SELECT count(*) INTO v_n FROM d;
  IF v_n <> 1 THEN v_fail := v_fail || format('D2: la secretaria borró %s documento(s) del borrador (esperaba 1)', v_n); END IF;
  EXECUTE 'RESET ROLE';

  -- D3: admin
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  WITH d AS (DELETE FROM public.student_documents WHERE enrollment_id = v_active RETURNING 1)
    SELECT count(*) INTO v_n FROM d;
  IF v_n <> 1 THEN v_fail := v_fail || format('D3: el admin borró %s documento(s) (esperaba 1)', v_n); END IF;
  EXECUTE 'RESET ROLE';

  IF array_length(v_fail, 1) > 0 THEN
    RAISE EXCEPTION 'FALLA fix-477-m: %', array_to_string(v_fail, ' | ');
  END IF;
  RAISE EXCEPTION 'OK fix-477-m: D1, D2, D3 (transacción revertida a propósito)';
END
$test$;

ROLLBACK;
