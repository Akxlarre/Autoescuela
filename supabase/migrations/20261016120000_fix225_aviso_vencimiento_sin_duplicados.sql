-- fix-225-b: el aviso de vencimiento de documentos no se duplica si la función corre dos veces
-- el mismo día (reintento del cron o ejecución manual). Decisión del owner 2026-10-16 (J08).
--
-- Copia de la función de fix-223-b (20261013130000) + un NOT EXISTS por destinatario, vehículo y
-- texto del aviso desde el inicio del día de Chile. Idempotente (CREATE OR REPLACE conserva los
-- permisos de fix-191-b).

CREATE OR REPLACE FUNCTION public.notify_vehicle_document_expiry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_today date := public.chile_today();
  v_advance_days INT;
  v_doc RECORD;
  v_recipient RECORD;
  v_subject TEXT;
  v_message TEXT;
BEGIN
  SELECT advance_days INTO v_advance_days
  FROM public.alert_config
  WHERE alert_type = 'document_expiry' AND active = true
  LIMIT 1;
  v_advance_days := COALESCE(v_advance_days, 30);

  FOR v_doc IN
    SELECT
      vd.id, vd.vehicle_id, vd.type, vd.expiry_date,
      v.license_plate, v.branch_id, COALESCE(v.both_branches, false) AS both_branches,
      CASE WHEN vd.expiry_date = v_today THEN 'today' ELSE 'expiring_soon' END AS reason
    FROM public.vehicle_documents vd
    JOIN public.vehicles v ON v.id = vd.vehicle_id
    WHERE vd.expiry_date = v_today
       OR vd.expiry_date = v_today + v_advance_days
  LOOP
    BEGIN
      IF v_doc.reason = 'today' THEN
        v_subject := 'Documento vence hoy';
        v_message := public.vehicle_document_type_label(v_doc.type) || ' del vehículo '
                     || v_doc.license_plate || ' vence hoy.';
      ELSE
        v_subject := 'Documento por vencer';
        v_message := public.vehicle_document_type_label(v_doc.type) || ' del vehículo '
                     || v_doc.license_plate || ' vence en ' || v_advance_days || ' días.';
      END IF;

      -- Instructor con asignación activa + admins activos + secretarias activas de la sede del
      -- vehículo (todas si es "Ambas"). UNION evita duplicados.
      FOR v_recipient IN
        SELECT i.user_id AS id
          FROM public.vehicle_assignments va
          JOIN public.instructors i ON i.id = va.instructor_id
         WHERE va.vehicle_id = v_doc.vehicle_id AND va.end_date IS NULL AND i.user_id IS NOT NULL
        UNION
        SELECT u.id
          FROM public.users u
          JOIN public.roles r ON r.id = u.role_id
         WHERE u.active = true
           AND (
             r.name = 'admin'
             OR (r.name = 'secretary' AND (v_doc.both_branches OR u.branch_id = v_doc.branch_id))
           )
      LOOP
        -- fix-225-b: una segunda corrida el mismo día no repite el aviso.
        IF NOT EXISTS (
          SELECT 1 FROM public.notifications n
           WHERE n.recipient_id = v_recipient.id
             AND n.reference_type = 'document_expiry'
             AND n.reference_id = v_doc.vehicle_id
             AND n.message = v_message
             AND n.created_at >= public.chile_day_start(v_today)
        ) THEN
          INSERT INTO public.notifications (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
          VALUES (v_recipient.id, 'system', v_subject, v_message, 'document_expiry', v_doc.vehicle_id, false, true);
        END IF;
      END LOOP;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_vehicle_document_expiry error (document_id=%): %', v_doc.id, SQLERRM;
    END;
  END LOOP;
END;
$function$;
