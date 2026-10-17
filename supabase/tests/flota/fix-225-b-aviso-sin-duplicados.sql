-- ============================================================================
-- Test — fix-225-b: el aviso de vencimiento no se duplica en el mismo día
-- ============================================================================
-- D1–D3 de specs/fixes/fix-225-b-aviso-vencimiento-sin-duplicados/fix.md. Usa el vehículo de
-- prueba 36 (ZZ4103) DENTRO de un sub-bloque que siempre aborta (SQLSTATE ZZ001): no deja
-- documentos ni notificaciones. Requiere la migración 20261016120000. Correr como postgres.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r225;
CREATE TEMP TABLE r225 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_res   text[] := '{}';
  V       constant int := 36;
  v_hoy   date := public.chile_today();
  v_adv   int;
  v_una   bigint;
  v_n     bigint;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vehicles WHERE id = V) THEN
    RAISE EXCEPTION 'Falta el vehículo de prueba %', V;
  END IF;
  SELECT COALESCE((SELECT advance_days FROM public.alert_config
                    WHERE alert_type = 'document_expiry' AND active = true LIMIT 1), 30) INTO v_adv;

  BEGIN
    UPDATE public.vehicle_documents SET expiry_date = v_hoy + 400
     WHERE expiry_date IN (v_hoy, v_hoy + v_adv);
    DELETE FROM public.notifications WHERE reference_type = 'document_expiry';
    INSERT INTO public.vehicle_documents (vehicle_id, type, expiry_date) VALUES
      (V, 'technical_inspection', v_hoy);

    PERFORM public.notify_vehicle_document_expiry();
    SELECT count(*) INTO v_una FROM public.notifications WHERE reference_type = 'document_expiry';
    v_res := v_res || format('D4 la primera corrida avisa|true|%s', (v_una > 0)::text);

    -- D1: segunda corrida el mismo día.
    PERFORM public.notify_vehicle_document_expiry();
    SELECT count(*) INTO v_n FROM public.notifications WHERE reference_type = 'document_expiry';
    v_res := v_res || format('D1 la segunda corrida no duplica|%s|%s', v_una, v_n);

    -- D2: otro documento que vence en advance_days → sí se agrega.
    INSERT INTO public.vehicle_documents (vehicle_id, type, expiry_date) VALUES
      (V, 'soap', v_hoy + v_adv);
    PERFORM public.notify_vehicle_document_expiry();
    SELECT count(*) INTO v_n FROM public.notifications WHERE reference_type = 'document_expiry';
    v_res := v_res || format('D2 un aviso distinto sí se agrega|%s|%s', v_una * 2, v_n);

    -- D3: un aviso igual de un día anterior no impide el de hoy.
    UPDATE public.notifications SET created_at = public.chile_day_start(v_hoy) - interval '1 hour'
     WHERE reference_type = 'document_expiry';
    PERFORM public.notify_vehicle_document_expiry();
    SELECT count(*) INTO v_n FROM public.notifications
     WHERE reference_type = 'document_expiry' AND created_at >= public.chile_day_start(v_hoy);
    v_res := v_res || format('D3 lo de ayer no bloquea el aviso de hoy|%s|%s', v_una * 2, v_n);

    RAISE SQLSTATE 'ZZ001';
  EXCEPTION
    WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  INSERT INTO r225
  SELECT split_part(r, '|', 1), split_part(r, '|', 2), split_part(r, '|', 3),
         CASE WHEN split_part(r, '|', 2) = split_part(r, '|', 3) THEN 'ok' ELSE 'FALLA' END
    FROM unnest(v_res) AS r;

  IF EXISTS (SELECT 1 FROM r225 WHERE resultado = 'FALLA') THEN
    RAISE EXCEPTION E'fix-225-b: % caso(s) fallaron:\n%',
      (SELECT count(*) FROM r225 WHERE resultado = 'FALLA'),
      (SELECT string_agg(format('%s — esperado %s, obtenido %s', caso, esperado, obtenido), E'\n')
         FROM r225 WHERE resultado = 'FALLA');
  END IF;
END
$test$;

SELECT count(*) AS casos, count(*) FILTER (WHERE resultado = 'ok') AS ok FROM r225;
