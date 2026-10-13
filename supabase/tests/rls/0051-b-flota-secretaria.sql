-- ============================================================================
-- Test de RLS — spec 0051-b: Flota para la secretaria, limitada a su sede
-- ============================================================================
-- AC3, AC4, AC5, AC8, AC-E1 y AC-E2 (specs/specs/0051-b-flota-secretaria/spec.md).
-- Impersona a admin, secretaria sede 1, secretaria sede 2, secretaria multi-sede e instructor,
-- e intenta registrar un mantenimiento, cargar un documento y editar/crear vehículos.
--
-- Todo ocurre DENTRO de un sub-bloque que siempre aborta (SQLSTATE ZZ001): no deja cambios.
-- Requiere la migración 20261012150000 aplicada. Correr como postgres.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r051;
CREATE TEMP TABLE r051 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_res   text[] := '{}';   -- 'caso|esperado|obtenido' (las variables sobreviven al aborto)
  v_actor record;
  v_veh   record;
  v_esperado boolean;
  v_ok    boolean;
  v_rows  bigint;
  v_id    int;
  v_sec1_id int;
  v_audit_user int;
  V_A     constant int := 1;    -- ABCD43: sede 1, no "Ambas"
  V_B     constant int := 3;    -- RTRE29: sede 2, no "Ambas"
  V_AMBAS constant int := 36;   -- ZZ4103: sede 1; se marca "Ambas" dentro del bloque
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;
  IF (SELECT count(*) FROM public.vehicles WHERE id IN (V_A, V_B, V_AMBAS)) <> 3
     OR (SELECT branch_id FROM public.vehicles WHERE id = V_A) <> 1
     OR (SELECT branch_id FROM public.vehicles WHERE id = V_B) <> 2 THEN
    RAISE EXCEPTION 'Faltan los vehículos de prueba (1 en sede 1, 3 en sede 2, 36)';
  END IF;
  SELECT id INTO v_sec1_id FROM public.users WHERE email = 'secretaria@test.com';

  BEGIN
    UPDATE public.vehicles SET both_branches = true WHERE id = V_AMBAS;

    FOR v_actor IN
      SELECT * FROM (VALUES
        ('admin',        'admin@test.com'),
        ('sec sede 1',   'secretaria@test.com'),
        ('sec sede 2',   'secretaria2@test.com'),
        ('sec con grant','secretaria.multisede@test.com'),
        ('instructor',   'instructor@test.com')
      ) AS a(nombre, email)
    LOOP
      FOR v_veh IN
        SELECT * FROM (VALUES
          (V_A, 'vehículo de sede 1', 1, false),
          (V_B, 'vehículo de sede 2', 2, false),
          (V_AMBAS, 'vehículo "Ambas"', 1, true)
        ) AS v(id, nombre, sede, ambas)
      LOOP
        -- La regla de la spec, escrita aparte de la función que se prueba.
        v_esperado := CASE v_actor.nombre
          WHEN 'admin' THEN true
          WHEN 'sec con grant' THEN true
          WHEN 'sec sede 1' THEN v_veh.sede = 1 AND NOT v_veh.ambas
          WHEN 'sec sede 2' THEN v_veh.sede = 2 AND NOT v_veh.ambas
          ELSE false
        END;

        PERFORM set_config('request.jwt.claims',
          json_build_object('sub', (SELECT supabase_uid FROM public.users WHERE email = v_actor.email),
                            'role', 'authenticated')::text, true);
        EXECUTE 'SET LOCAL ROLE authenticated';

        -- 1. Registrar un mantenimiento
        BEGIN
          INSERT INTO public.maintenance_records (vehicle_id, description)
          VALUES (v_veh.id, 'test 0051-b') RETURNING id INTO v_id;
          v_ok := true;
        EXCEPTION WHEN insufficient_privilege THEN v_ok := false;
        END;
        v_res := v_res || format('%s registra mantenimiento en %s|%s|%s', v_actor.nombre, v_veh.nombre, v_esperado, v_ok);

        -- 1b. Editarlo (si lo creó) o editar uno ajeno: nunca más filas de las que puede operar
        IF v_ok THEN
          UPDATE public.maintenance_records SET description = 'test 0051-b editado' WHERE id = v_id;
          GET DIAGNOSTICS v_rows = ROW_COUNT;
          v_res := v_res || format('%s edita ese mantenimiento|1|%s', v_actor.nombre, v_rows);
        END IF;

        -- 2. Cargar un documento
        BEGIN
          INSERT INTO public.vehicle_documents (vehicle_id, type, expiry_date)
          VALUES (v_veh.id, 'test_0051b_' || left(md5(v_actor.email), 6), DATE '2030-01-01');
          v_ok := true;
        EXCEPTION WHEN insufficient_privilege THEN v_ok := false;
        END;
        v_res := v_res || format('%s carga documento en %s|%s|%s', v_actor.nombre, v_veh.nombre, v_esperado, v_ok);

        -- 3. Editar la ficha del vehículo (el instructor tiene su propia rama: no se evalúa aquí)
        IF v_actor.nombre <> 'instructor' THEN
          UPDATE public.vehicles SET current_km = current_km WHERE id = v_veh.id;
          GET DIAGNOSTICS v_rows = ROW_COUNT;
          v_res := v_res || format('%s edita la ficha de %s|%s|%s', v_actor.nombre, v_veh.nombre, v_esperado, v_rows = 1);
        END IF;

        EXECUTE 'RESET ROLE';
      END LOOP;

      -- 4. Crear vehículos
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', (SELECT supabase_uid FROM public.users WHERE email = v_actor.email),
                          'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      FOR v_veh IN
        SELECT * FROM (VALUES
          (1, 'en sede 1', 1, false),
          (2, 'en sede 2', 2, false),
          (3, '"Ambas" en sede 1', 1, true)
        ) AS v(id, nombre, sede, ambas)
      LOOP
        v_esperado := CASE v_actor.nombre
          WHEN 'admin' THEN true
          WHEN 'sec con grant' THEN true
          WHEN 'sec sede 1' THEN v_veh.sede = 1 AND NOT v_veh.ambas
          WHEN 'sec sede 2' THEN v_veh.sede = 2 AND NOT v_veh.ambas
          ELSE false
        END;
        BEGIN
          INSERT INTO public.vehicles (license_plate, brand, model, year, branch_id, both_branches, status)
          VALUES ('T51' || v_veh.id || left(md5(v_actor.email), 3), 'Test', '0051-b', 2024,
                  v_veh.sede, v_veh.ambas, 'available');
          v_ok := true;
        EXCEPTION WHEN insufficient_privilege THEN v_ok := false;
        END;
        v_res := v_res || format('%s crea un vehículo %s|%s|%s', v_actor.nombre, v_veh.nombre, v_esperado, v_ok);
      END LOOP;
      EXECUTE 'RESET ROLE';
    END LOOP;

    -- AC-E1: lo que hizo la secretaria de la sede 1 queda en la auditoría a su nombre.
    SELECT a.user_id INTO v_audit_user
      FROM public.audit_log a
      JOIN public.maintenance_records m ON m.id = a.entity_id
     WHERE a.entity = 'maintenance_records' AND a.action = 'INSERT'
       AND m.vehicle_id = V_A AND a.user_id = v_sec1_id
     LIMIT 1;
    v_res := v_res || format('AC-E1 el mantenimiento de la sec sede 1 queda auditado a su nombre|%s|%s',
                             v_sec1_id, coalesce(v_audit_user::text, 'sin autor'));

    RAISE SQLSTATE 'ZZ001';   -- deshace todo lo anterior
  EXCEPTION
    WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  INSERT INTO r051
  SELECT split_part(r, '|', 1), split_part(r, '|', 2), split_part(r, '|', 3),
         CASE WHEN split_part(r, '|', 2) = split_part(r, '|', 3) THEN 'ok' ELSE 'FALLA' END
    FROM unnest(v_res) AS r;

  IF EXISTS (SELECT 1 FROM r051 WHERE resultado = 'FALLA') THEN
    RAISE EXCEPTION E'spec 0051-b: % caso(s) fallaron:\n%',
      (SELECT count(*) FROM r051 WHERE resultado = 'FALLA'),
      (SELECT string_agg(format('%s — esperado %s, obtenido %s', caso, esperado, obtenido), E'\n')
         FROM r051 WHERE resultado = 'FALLA');
  END IF;
END
$test$;

SELECT count(*) AS casos, count(*) FILTER (WHERE resultado = 'ok') AS ok FROM r051;
