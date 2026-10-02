-- ============================================================================
-- Test de RLS — fix-180-b: un usuario desactivado pierde el acceso con su token vigente
-- ============================================================================
-- F1 (specs/fixes/fix-180-b-usuarios-desactivados-siguen-entrando/fix.md):
--   · activa   → auth_user_role() = 'secretary' y lee sus matrículas/clases
--   · inactiva → auth_user_role() IS NULL, lee 0 filas y no puede escribir
--
-- Desactiva a secretaria@test.com DENTRO de un sub-bloque que siempre aborta (SQLSTATE ZZ001):
-- no deja cambios en la BD. Correr como postgres; recomendado BEGIN … ROLLBACK.
-- ============================================================================

DO $test$
DECLARE
  v_fail  text[] := '{}';
  v_log   text[] := '{}';
  v_uid   uuid;
  v_enr   int;
  v_role  text;
  v_n_enr bigint;
  v_n_cls bigint;
  v_n_usr bigint;
  v_upd   bigint;
  v_estado text;
  v_activa boolean;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Correr como postgres (current_user = %)', current_user;
  END IF;
  SELECT supabase_uid INTO v_uid FROM public.users WHERE email = 'secretaria@test.com';
  SELECT id INTO v_enr FROM public.enrollments WHERE branch_id = 1 ORDER BY id LIMIT 1;
  IF v_uid IS NULL OR v_enr IS NULL THEN
    RAISE EXCEPTION 'Faltan datos de prueba';
  END IF;

  FOREACH v_activa IN ARRAY ARRAY[true, false] LOOP
    v_role := NULL; v_n_enr := NULL; v_n_cls := NULL; v_n_usr := NULL; v_upd := NULL; v_estado := NULL;
    BEGIN
      UPDATE public.users SET active = v_activa WHERE supabase_uid = v_uid;

      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      v_role := public.auth_user_role();
      SELECT count(*) INTO v_n_enr FROM public.enrollments;
      SELECT count(*) INTO v_n_cls FROM public.class_b_sessions;
      SELECT count(*) INTO v_n_usr FROM public.users;
      BEGIN
        UPDATE public.enrollments SET status = status WHERE id = v_enr;
        GET DIAGNOSTICS v_upd = ROW_COUNT;
      EXCEPTION WHEN OTHERS THEN
        v_estado := SQLSTATE;
      END;
      RAISE SQLSTATE 'ZZ001';               -- deshace el cambio de active
    EXCEPTION
      WHEN SQLSTATE 'ZZ001' THEN NULL;
      WHEN OTHERS THEN v_fail := v_fail || format('activa=%s: error inesperado %s %s', v_activa, SQLSTATE, SQLERRM);
    END;
    EXECUTE 'RESET ROLE';

    IF v_activa THEN
      IF v_role IS DISTINCT FROM 'secretary' OR v_n_enr = 0 OR v_n_cls = 0 OR v_upd IS DISTINCT FROM 1 THEN
        v_fail := v_fail || format('ACTIVA: rol=%s matrículas=%s clases=%s update=%s (%s) — debería operar normal',
                                   v_role, v_n_enr, v_n_cls, v_upd, v_estado);
      ELSE
        v_log := v_log || format('ok ACTIVA: rol=%s matrículas=%s clases=%s update=%s', v_role, v_n_enr, v_n_cls, v_upd);
      END IF;
    ELSE
      IF v_role IS NOT NULL OR v_n_enr <> 0 OR v_n_cls <> 0 OR v_n_usr <> 0 OR coalesce(v_upd, 0) <> 0 THEN
        v_fail := v_fail || format('INACTIVA: rol=%s matrículas=%s clases=%s usuarios=%s update=%s — debería perder todo acceso',
                                   v_role, v_n_enr, v_n_cls, v_n_usr, v_upd);
      ELSE
        v_log := v_log || format('ok INACTIVA: rol=%s matrículas=%s clases=%s usuarios=%s update=%s',
                                 coalesce(v_role, 'NULL'), v_n_enr, v_n_cls, v_n_usr, coalesce(v_upd, 0));
      END IF;
    END IF;
  END LOOP;

  IF array_length(v_fail, 1) > 0 THEN
    RAISE EXCEPTION E'fix-180-b: % caso(s) fallaron:\n%\n---\n%',
      array_length(v_fail, 1), array_to_string(v_fail, E'\n'), array_to_string(v_log, E'\n');
  END IF;
  RAISE NOTICE E'fix-180-b: todos los casos pasaron\n%', array_to_string(v_log, E'\n');
END
$test$;
