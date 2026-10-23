-- ============================================================================
-- Test — fix-460-m: certificate_enabled = clases completadas ≥ las del curso
-- ============================================================================
-- Verifica (ver specs/fixes/fix-460-m-certificate-enabled-recalculado/fix.md):
--   C1  en toda matrícula Clase B el flag coincide con la regla
--   C2  revertir una clase completada de una matrícula que cumple apaga el flag; volver a
--       completarla lo prende (en un sub-bloque que siempre aborta: no deja cambios)
-- Correr como postgres.
-- ============================================================================

DO $test$
DECLARE
  v_fail  text[] := '{}';
  v_log   text[] := '{}';
  v_bad   bigint;
  v_enr   int;
  v_ses   int;
  v_off   boolean;
  v_on    boolean;
  v_state text;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Correr como postgres (current_user = %)', current_user;
  END IF;

  -- C1
  SELECT count(*) INTO v_bad
    FROM public.enrollments e
    JOIN public.courses c ON c.id = e.course_id
   WHERE e.license_group = 'class_b'
     AND e.certificate_enabled IS DISTINCT FROM (
           (SELECT count(*) FROM public.class_b_sessions s
             WHERE s.enrollment_id = e.id AND s.status = 'completed')
           >= COALESCE(NULLIF(ROUND(c.practical_hours * 60 / 45)::int, 0), 12));
  IF v_bad > 0 THEN
    v_fail := v_fail || format('C1: %s matrículas Clase B con el flag distinto de la regla', v_bad);
  ELSE
    v_log := v_log || 'ok C1: el flag coincide con la regla en todas las matrículas Clase B'::text;
  END IF;

  -- C2: una matrícula que cumple y una de sus clases completadas.
  SELECT e.id, s.id INTO v_enr, v_ses
    FROM public.enrollments e
    JOIN public.class_b_sessions s ON s.enrollment_id = e.id AND s.status = 'completed'
   WHERE e.license_group = 'class_b' AND e.certificate_enabled
   LIMIT 1;

  IF v_enr IS NULL THEN
    v_log := v_log || 'aviso C2: no hay matrícula Clase B habilitada para probar'::text;
  ELSE
    BEGIN
      UPDATE public.class_b_sessions SET status = 'scheduled' WHERE id = v_ses;
      SELECT certificate_enabled INTO v_off FROM public.enrollments WHERE id = v_enr;
      UPDATE public.class_b_sessions SET status = 'completed' WHERE id = v_ses;
      SELECT certificate_enabled INTO v_on FROM public.enrollments WHERE id = v_enr;
      RAISE EXCEPTION USING ERRCODE = 'ZZ001';
    EXCEPTION
      WHEN SQLSTATE 'ZZ001' THEN v_state := 'ok';
      WHEN OTHERS THEN v_state := SQLSTATE || ' ' || SQLERRM;
    END;
    IF v_state <> 'ok' OR v_off IS DISTINCT FROM false OR v_on IS DISTINCT FROM true THEN
      v_fail := v_fail || format('C2: matrícula %s → al revertir=%s, al completar=%s, estado=%s',
                                 v_enr, v_off, v_on, v_state);
    ELSE
      v_log := v_log || format('ok C2: matrícula %s baja a false y vuelve a true', v_enr);
    END IF;
  END IF;

  IF array_length(v_fail, 1) > 0 THEN
    RAISE EXCEPTION E'fix-460-m: % caso(s) fallaron:\n%\n---\n%',
      array_length(v_fail, 1), array_to_string(v_fail, E'\n'), array_to_string(v_log, E'\n');
  END IF;
  RAISE NOTICE E'fix-460-m: todos los casos pasaron\n%', array_to_string(v_log, E'\n');
END
$test$;
