-- ============================================================================
-- Test — fix-461-m: issue_certificate emite de forma atómica e idempotente
-- ============================================================================
-- Verifica (ver specs/fixes/fix-461-m-folio-certificado-atomico/fix.md):
--   I1  existe el índice único (enrollment_id, type)
--   I2  emitir dos veces la misma matrícula devuelve el mismo id y folio (created=false la 2ª)
--   I3  dos matrículas distintas obtienen folios consecutivos
--   I4  authenticated no puede ejecutar la RPC
-- Todo lo que escribe va en un sub-bloque que siempre aborta (ZZ001). Correr como postgres.
-- ============================================================================

DO $test$
DECLARE
  v_fail  text[] := '{}';
  v_log   text[] := '{}';
  v_e1 int; v_s1 int; v_e2 int; v_s2 int;
  a record; b record; c record;
  v_state text;
  v_can   boolean;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Correr como postgres (current_user = %)', current_user;
  END IF;

  -- I1
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'certificates_enrollment_type_key') THEN
    v_log := v_log || 'ok I1: índice único (enrollment_id, type)'::text;
  ELSE
    v_fail := v_fail || 'I1: falta certificates_enrollment_type_key'::text;
  END IF;

  -- I4
  SELECT has_function_privilege('authenticated', 'public.issue_certificate(int,int,text,int)', 'EXECUTE')
    INTO v_can;
  IF v_can THEN
    v_fail := v_fail || 'I4: authenticated puede ejecutar issue_certificate'::text;
  ELSE
    v_log := v_log || 'ok I4: authenticated no puede ejecutarla'::text;
  END IF;

  -- Dos matrículas Clase B sin certificado.
  SELECT e.id, e.student_id INTO v_e1, v_s1 FROM public.enrollments e
   WHERE e.license_group = 'class_b'
     AND NOT EXISTS (SELECT 1 FROM public.certificates x WHERE x.enrollment_id = e.id)
   ORDER BY e.id LIMIT 1;
  SELECT e.id, e.student_id INTO v_e2, v_s2 FROM public.enrollments e
   WHERE e.license_group = 'class_b' AND e.id <> v_e1
     AND NOT EXISTS (SELECT 1 FROM public.certificates x WHERE x.enrollment_id = e.id)
   ORDER BY e.id LIMIT 1;

  BEGIN
    SELECT * INTO a FROM public.issue_certificate(v_e1, v_s1, 'class_b', NULL);
    SELECT * INTO b FROM public.issue_certificate(v_e1, v_s1, 'class_b', NULL);
    SELECT * INTO c FROM public.issue_certificate(v_e2, v_s2, 'class_b', NULL);
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION
    WHEN SQLSTATE 'ZZ001' THEN v_state := 'ok';
    WHEN OTHERS THEN v_state := SQLSTATE || ' ' || SQLERRM;
  END;

  IF v_state <> 'ok' THEN
    v_fail := v_fail || format('I2/I3: error al emitir: %s', v_state);
  ELSE
    IF a.created AND NOT b.created AND a.id = b.id AND a.folio = b.folio THEN
      v_log := v_log || format('ok I2: misma matrícula → mismo certificado (folio %s)', a.folio);
    ELSE
      v_fail := v_fail || format('I2: a=%s b=%s', row_to_json(a), row_to_json(b));
    END IF;
    IF c.created AND c.folio = a.folio + 1 THEN
      v_log := v_log || format('ok I3: folios consecutivos %s → %s', a.folio, c.folio);
    ELSE
      v_fail := v_fail || format('I3: a.folio=%s c=%s', a.folio, row_to_json(c));
    END IF;
  END IF;

  IF array_length(v_fail, 1) > 0 THEN
    RAISE EXCEPTION E'fix-461-m: % caso(s) fallaron:\n%\n---\n%',
      array_length(v_fail, 1), array_to_string(v_fail, E'\n'), array_to_string(v_log, E'\n');
  END IF;
  RAISE NOTICE E'fix-461-m: todos los casos pasaron\n%', array_to_string(v_log, E'\n');
END
$test$;
