-- ============================================================================
-- Test — spec 0057-b: la disponibilidad de Clase B dice de qué sede es cada bloque
-- ============================================================================
-- AC1, AC2/AC3 (en la vista), AC5, AC-E1 y AC-E2 de
-- specs/specs/0057-b-disponibilidad-clase-b-por-sede/spec.md. Marca un instructor de la sede 1
-- con asignación activa (y después su vehículo) como "Ambas" DENTRO de un sub-bloque que siempre
-- aborta (SQLSTATE ZZ001): no deja cambios. Lee la vista como postgres y como la secretaria de la
-- sede 2 (regla de fix-226-b). Requiere la migración 20261106150000. Correr como postgres.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r0057;
CREATE TEMP TABLE r0057 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_res   text[] := '{}';
  v_i     int;
  v_v     int;
  v_sede  int;
  v_otra  int;
  v_n     bigint;
  v_sec2  uuid;
  v_err   text := 'ok';
  v_desde timestamptz := now();
  v_hasta timestamptz := now() + interval '14 days';
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  -- Un instructor de una sola sede, con vehículo de una sola sede (la misma).
  SELECT va.instructor_id, va.vehicle_id, u.branch_id INTO v_i, v_v, v_sede
    FROM public.vehicle_assignments va
    JOIN public.instructors i ON i.id = va.instructor_id
    JOIN public.users u ON u.id = i.user_id
    JOIN public.vehicles v ON v.id = va.vehicle_id
   WHERE va.end_date IS NULL AND i.active AND NOT i.both_branches AND NOT v.both_branches
     AND u.branch_id = 1 AND v.branch_id = 1
     AND public.vehicle_is_operational(v.status)
   ORDER BY va.instructor_id LIMIT 1;
  v_otra := 2;
  SELECT supabase_uid INTO v_sec2 FROM public.users WHERE email = 'secretaria2@test.com';
  IF v_i IS NULL OR v_sec2 IS NULL THEN
    RAISE EXCEPTION 'Faltan datos de prueba (instructor de la sede 1 con vehículo, secretaria2)';
  END IF;

  -- AC1: toda fila trae branch_ids, no vacío y dentro de las sedes con curso Clase B activo.
  SELECT count(*) INTO v_n FROM public.v_class_b_schedule_availability a
   WHERE a.slot_start >= v_desde AND a.slot_start < v_hasta
     AND (a.branch_ids IS NULL OR cardinality(a.branch_ids) = 0
          OR NOT a.branch_ids <@ (SELECT array_agg(DISTINCT c.branch_id) FROM public.courses c
                                   WHERE c.type = 'class_b' AND c.active));
  v_res := v_res || format('AC1 toda fila con branch_ids válido|0|%s', v_n);

  -- AC-E1: un instructor de una sola sede solo trae su sede.
  SELECT count(*) INTO v_n FROM public.v_class_b_schedule_availability
   WHERE instructor_id = v_i AND slot_start >= v_desde AND slot_start < v_hasta
     AND branch_ids <> ARRAY[v_sede];
  v_res := v_res || format('AC-E1 instructor de una sede: solo su sede|0|%s', v_n);

  BEGIN
    -- AC2/AC3 (F08): instructor "Ambas", vehículo solo de la sede 1.
    UPDATE public.instructors SET both_branches = true WHERE id = v_i;

    SELECT count(*) INTO v_n FROM public.v_class_b_schedule_availability
     WHERE instructor_id = v_i AND slot_start >= v_desde AND slot_start < v_hasta
       AND branch_ids @> ARRAY[v_otra];
    v_res := v_res || format('AC2 sin bloques para la sede que el vehículo no cubre|0|%s', v_n);

    SELECT count(*) INTO v_n FROM public.v_class_b_schedule_availability
     WHERE instructor_id = v_i AND slot_start >= v_desde AND slot_start < v_hasta
       AND branch_ids = ARRAY[v_sede];
    v_res := v_res || format('AC3 sigue con bloques en su sede|true|%s', (v_n > 0)::text);

    -- AC5: con el vehículo también "Ambas", una sola fila por bloque, con las dos sedes.
    UPDATE public.vehicles SET both_branches = true WHERE id = v_v;

    SELECT count(*) INTO v_n FROM (
      SELECT 1 FROM public.v_class_b_schedule_availability
       WHERE instructor_id = v_i AND slot_start >= v_desde AND slot_start < v_hasta
       GROUP BY instructor_id, vehicle_id, slot_start HAVING count(*) > 1) d;
    v_res := v_res || format('AC5 una fila por bloque (fix-227-b)|0|%s', v_n);

    SELECT count(*) INTO v_n FROM public.v_class_b_schedule_availability
     WHERE instructor_id = v_i AND slot_start >= v_desde AND slot_start < v_hasta
       AND branch_ids <> ARRAY[1, 2];
    v_res := v_res || format('AC5 cada bloque con las dos sedes|0|%s', v_n);

    -- AC-E2: la secretaria de la sede 2 lee la vista y ve los bloques del instructor en su sede.
    BEGIN
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_sec2, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      SELECT count(*) INTO v_n FROM public.v_class_b_schedule_availability
       WHERE instructor_id = v_i AND slot_start >= v_desde AND slot_start < v_hasta
         AND branch_ids @> ARRAY[v_otra];
      EXECUTE 'RESET ROLE';
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM;
      EXECUTE 'RESET ROLE';
    END;
    v_res := v_res || format('AC-E2 la secretaria 2 lee la vista|ok|%s', v_err);
    v_res := v_res || format('AC-E2 y ve los bloques del instructor "Ambas" en su sede|true|%s',
                             (v_n > 0)::text);

    RAISE SQLSTATE 'ZZ001';
  EXCEPTION
    WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  INSERT INTO r0057
  SELECT split_part(r, '|', 1), split_part(r, '|', 2), split_part(r, '|', 3),
         CASE WHEN split_part(r, '|', 2) = split_part(r, '|', 3) THEN 'ok' ELSE 'FALLA' END
    FROM unnest(v_res) AS r;

  IF EXISTS (SELECT 1 FROM r0057 WHERE resultado = 'FALLA') THEN
    RAISE EXCEPTION E'spec 0057-b: % caso(s) fallaron:\n%',
      (SELECT count(*) FROM r0057 WHERE resultado = 'FALLA'),
      (SELECT string_agg(format('%s — esperado %s, obtenido %s', caso, esperado, obtenido), E'\n')
         FROM r0057 WHERE resultado = 'FALLA');
  END IF;
END
$test$;

SELECT * FROM r0057;
