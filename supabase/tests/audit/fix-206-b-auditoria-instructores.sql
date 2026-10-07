-- ============================================================================
-- Prueba de BD — fix-206-b: auditoría de instructors, vehicle_assignments y branch_payroll_config
-- ============================================================================
-- ACs en specs/fixes/fix-206-b-auditoria-instructores-vehiculos-nomina/fix.md (F1–F5).
-- Lo que escribe corre en un sub-bloque que SIEMPRE aborta (ZZ001): no deja cambios ni filas en
-- audit_log. Correr como postgres. Resultado en la tabla temporal r206 (último SELECT);
-- "FALLA" = ❌. Datos de prueba: instructor 223 (sede 1) con su asignación abierta de vehículo y el
-- valor hora de la sede 1.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r206;
CREATE TEMP TABLE r206 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_max      bigint;
  v_inst     record;
  v_asig     record;
  v_pay      record;
  v_veh      record;
  v_ins_name text;
  v_plate    text;
  v_sede     text;
  v_triggers int;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT count(*) INTO v_triggers FROM pg_trigger
   WHERE tgname IN ('trg_audit_instructors', 'trg_audit_vehicle_assignments',
                    'trg_audit_branch_payroll_config') AND NOT tgisinternal;
  INSERT INTO r206 VALUES ('F1 triggers instalados', '3', v_triggers::text,
    CASE WHEN v_triggers = 3 THEN 'ok' ELSE 'FALLA' END);

  SELECT u.first_names || ' ' || u.paternal_last_name INTO v_ins_name
    FROM public.instructors i JOIN public.users u ON u.id = i.user_id WHERE i.id = 223;
  SELECT v.license_plate INTO v_plate
    FROM public.vehicle_assignments va JOIN public.vehicles v ON v.id = va.vehicle_id
   WHERE va.instructor_id = 223 AND va.end_date IS NULL ORDER BY va.id LIMIT 1;
  SELECT name INTO v_sede FROM public.branches WHERE id = 1;

  BEGIN
    SELECT coalesce(max(id), 0) INTO v_max FROM public.audit_log;

    UPDATE public.instructors
       SET license_number = coalesce(license_number, '') || '-T', both_branches = NOT both_branches
     WHERE id = 223;
    SELECT entity_id, branch_id, detail INTO v_inst FROM public.audit_log
     WHERE id > v_max AND entity = 'instructors' ORDER BY id DESC LIMIT 1;

    UPDATE public.vehicle_assignments SET end_date = current_date
     WHERE instructor_id = 223 AND end_date IS NULL;
    SELECT branch_id, detail INTO v_asig FROM public.audit_log
     WHERE id > v_max AND entity = 'vehicle_assignments' ORDER BY id DESC LIMIT 1;

    UPDATE public.branch_payroll_config
       SET amount_per_hour = amount_per_hour + 1,
           updated_by = CASE WHEN updated_by IS NULL THEN (SELECT min(id) FROM public.users) END
     WHERE branch_id = 1;
    SELECT entity_id, branch_id, detail INTO v_pay FROM public.audit_log
     WHERE id > v_max AND entity = 'branch_payroll_config' ORDER BY id DESC LIMIT 1;

    -- F5: una tabla ya auditada sigue igual.
    UPDATE public.vehicles SET model = coalesce(model, '') || 'T' WHERE license_plate = v_plate;
    SELECT detail INTO v_veh FROM public.audit_log
     WHERE id > v_max AND entity = 'vehicles' ORDER BY id DESC LIMIT 1;

    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN
    NULL; -- deshace los cambios y sus filas de audit_log (las variables sobreviven)
  END;

  INSERT INTO r206 VALUES ('F1 instructors: sede, id y texto legible',
    format('223 · sede 1 · [Instructor %s] …', v_ins_name),
    format('%s · sede %s · %s', v_inst.entity_id, v_inst.branch_id, v_inst.detail),
    CASE WHEN v_inst.entity_id = 223 AND v_inst.branch_id = 1
          AND v_inst.detail LIKE '[Instructor ' || v_ins_name || '] %' THEN 'ok' ELSE 'FALLA' END);

  INSERT INTO r206 VALUES ('F2 instructors: etiquetas en español',
    'Ambas sedes + N° de licencia', v_inst.detail,
    CASE WHEN v_inst.detail LIKE '%Ambas sedes: %' AND v_inst.detail LIKE '%N° de licencia: %'
         THEN 'ok' ELSE 'FALLA' END);

  INSERT INTO r206 VALUES ('F1 vehicle_assignments: patente + instructor + sede',
    format('sede 1 · [Vehículo %s - %s] Fecha de término: …', v_plate, v_ins_name),
    format('sede %s · %s', v_asig.branch_id, v_asig.detail),
    CASE WHEN v_asig.branch_id = 1
          AND v_asig.detail LIKE '[Vehículo ' || v_plate || ' - ' || v_ins_name || '] Fecha de término: %'
         THEN 'ok' ELSE 'FALLA' END);

  INSERT INTO r206 VALUES ('F1/F2/F3 branch_payroll_config: entity_id = sede, sin "Actualizado por"',
    format('1 · sede 1 · [Valor hora instructores - %s] Valor por hora: …', v_sede),
    format('%s · sede %s · %s', v_pay.entity_id, v_pay.branch_id, v_pay.detail),
    CASE WHEN v_pay.entity_id = 1 AND v_pay.branch_id = 1
          AND v_pay.detail LIKE '[Valor hora instructores - ' || v_sede || '] Valor por hora: %'
          AND v_pay.detail NOT LIKE '%Actualizado por%' THEN 'ok' ELSE 'FALLA' END);

  INSERT INTO r206 VALUES ('F5 vehicles sigue auditándose igual',
    format('[%s (…)] Modelo: …', v_plate), v_veh.detail,
    CASE WHEN v_veh.detail LIKE '[' || v_plate || ' (%)] Modelo: %' THEN 'ok' ELSE 'FALLA' END);

  -- Nada quedó escrito.
  INSERT INTO r206 VALUES ('Sin efectos: audit_log no creció', v_max::text,
    (SELECT coalesce(max(id), 0) FROM public.audit_log)::text,
    CASE WHEN (SELECT coalesce(max(id), 0) FROM public.audit_log) = v_max THEN 'ok' ELSE 'FALLA' END);
END $test$;

SELECT * FROM r206 ORDER BY caso;
