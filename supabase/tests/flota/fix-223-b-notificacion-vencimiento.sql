-- ============================================================================
-- Test — fix-223-b: aviso de vencimiento de documentos de vehículo
-- ============================================================================
-- N1–N5 de specs/fixes/fix-223-b-notificacion-vencimiento-documento/fix.md.
-- Usa el vehículo de prueba 36 (ZZ4103) DENTRO de un sub-bloque que siempre aborta
-- (SQLSTATE ZZ001): no deja documentos ni notificaciones. Requiere la migración 20261013130000.
-- Correr como postgres.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r223;
CREATE TEMP TABLE r223 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_res     text[] := '{}';
  V         constant int := 36;
  v_hoy     date := public.chile_today();
  v_adv     int;
  v_branch  int;
  v_sec_own int;
  v_sec_oth int;
  v_admins  int;
  v_esperado int;
  v_txt     text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;
  SELECT branch_id INTO v_branch FROM public.vehicles WHERE id = V;
  IF v_branch IS NULL THEN RAISE EXCEPTION 'Falta el vehículo de prueba % (o no tiene sede)', V; END IF;

  SELECT COALESCE((SELECT advance_days FROM public.alert_config
                    WHERE alert_type = 'document_expiry' AND active = true LIMIT 1), 30) INTO v_adv;

  SELECT count(*) INTO v_admins FROM public.users u JOIN public.roles r ON r.id = u.role_id
   WHERE r.name = 'admin' AND u.active;
  SELECT u.id INTO v_sec_own FROM public.users u JOIN public.roles r ON r.id = u.role_id
   WHERE r.name = 'secretary' AND u.active AND u.branch_id = v_branch ORDER BY u.id LIMIT 1;
  SELECT u.id INTO v_sec_oth FROM public.users u JOIN public.roles r ON r.id = u.role_id
   WHERE r.name = 'secretary' AND u.active AND u.branch_id <> v_branch ORDER BY u.id LIMIT 1;
  IF v_sec_own IS NULL OR v_sec_oth IS NULL THEN
    RAISE EXCEPTION 'Faltan secretarias activas en la sede % y en otra sede', v_branch;
  END IF;

  BEGIN
    -- Escenario aislado: el vehículo sin asignación activa ni otros documentos que venzan hoy
    -- o en v_adv días; los documentos de otros vehículos que coincidan se sacan del camino.
    UPDATE public.vehicles SET both_branches = false WHERE id = V;
    UPDATE public.vehicle_assignments SET end_date = v_hoy - 1 WHERE vehicle_id = V AND end_date IS NULL;
    UPDATE public.vehicle_documents SET expiry_date = v_hoy + 400
     WHERE expiry_date IN (v_hoy, v_hoy + v_adv);
    DELETE FROM public.notifications WHERE reference_type = 'document_expiry';

    INSERT INTO public.vehicle_documents (vehicle_id, type, expiry_date) VALUES
      (V, 'technical_inspection', v_hoy),
      (V, 'soap', v_hoy + v_adv),
      (V, 'insurance', v_hoy + 1);

    PERFORM public.notify_vehicle_document_expiry();

    -- N1 + N2
    SELECT max(subject || ' / ' || message) INTO v_txt FROM public.notifications
     WHERE reference_type = 'document_expiry' AND message LIKE 'Revisión Técnica%';
    v_res := v_res || format('N1/N2 vence hoy, con etiqueta en español|%s|%s',
      'Documento vence hoy / Revisión Técnica del vehículo ZZ4103 vence hoy.', v_txt);

    -- N1 + N3
    SELECT max(subject || ' / ' || message) INTO v_txt FROM public.notifications
     WHERE reference_type = 'document_expiry' AND message LIKE 'SOAP%';
    v_res := v_res || format('N1/N3 por vencer, con etiqueta en español|%s|%s',
      format('Documento por vencer / SOAP del vehículo ZZ4103 vence en %s días.', v_adv), v_txt);

    -- N5: el que vence mañana no avisa; ningún mensaje lleva el tipo crudo.
    v_res := v_res || format('N5 un documento que vence mañana no avisa|0|%s',
      (SELECT count(*) FROM public.notifications WHERE reference_type = 'document_expiry' AND message LIKE 'Seguro%'));
    v_res := v_res || format('N1 ningún mensaje con el tipo crudo|0|%s',
      (SELECT count(*) FROM public.notifications WHERE reference_type = 'document_expiry'
        AND (message LIKE 'soap%' OR message LIKE 'technical_inspection%')));

    -- N4: admins + secretarias de la sede, no las de otra sede.
    SELECT v_admins + count(*) INTO v_esperado FROM public.users u JOIN public.roles r ON r.id = u.role_id
     WHERE r.name = 'secretary' AND u.active AND u.branch_id = v_branch;
    v_res := v_res || format('N4 destinatarios por documento (admins + secretarias de la sede)|%s|%s', v_esperado,
      (SELECT count(*) FROM public.notifications WHERE reference_type = 'document_expiry' AND message LIKE 'SOAP%'));
    v_res := v_res || format('N4 la secretaria de la sede recibe el aviso|1|%s',
      (SELECT count(*) FROM public.notifications WHERE reference_type = 'document_expiry'
        AND message LIKE 'SOAP%' AND recipient_id = v_sec_own));
    v_res := v_res || format('N4 la secretaria de otra sede no lo recibe|0|%s',
      (SELECT count(*) FROM public.notifications WHERE reference_type = 'document_expiry'
        AND recipient_id = v_sec_oth));

    -- N4: vehículo "Ambas" → también la secretaria de otra sede.
    DELETE FROM public.notifications WHERE reference_type = 'document_expiry';
    UPDATE public.vehicles SET both_branches = true WHERE id = V;
    PERFORM public.notify_vehicle_document_expiry();
    v_res := v_res || format('N4 vehículo "Ambas": la secretaria de otra sede recibe ambos avisos|2|%s',
      (SELECT count(*) FROM public.notifications WHERE reference_type = 'document_expiry'
        AND recipient_id = v_sec_oth));

    -- N4: un admin que además es el instructor asignado no se duplica.
    v_res := v_res || format('N4 sin destinatarios duplicados|0|%s',
      (SELECT count(*) FROM (SELECT recipient_id, message FROM public.notifications
                              WHERE reference_type = 'document_expiry'
                              GROUP BY 1, 2 HAVING count(*) > 1) d));

    RAISE SQLSTATE 'ZZ001';
  EXCEPTION
    WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  INSERT INTO r223
  SELECT split_part(r, '|', 1), split_part(r, '|', 2), split_part(r, '|', 3),
         CASE WHEN split_part(r, '|', 2) = split_part(r, '|', 3) THEN 'ok' ELSE 'FALLA' END
    FROM unnest(v_res) AS r;

  IF EXISTS (SELECT 1 FROM r223 WHERE resultado = 'FALLA') THEN
    RAISE EXCEPTION E'fix-223-b: % caso(s) fallaron:\n%',
      (SELECT count(*) FROM r223 WHERE resultado = 'FALLA'),
      (SELECT string_agg(format('%s — esperado %s, obtenido %s', caso, esperado, obtenido), E'\n')
         FROM r223 WHERE resultado = 'FALLA');
  END IF;
END
$test$;

SELECT count(*) AS casos, count(*) FILTER (WHERE resultado = 'ok') AS ok FROM r223;
