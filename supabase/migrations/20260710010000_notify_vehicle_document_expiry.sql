-- Spec 0027 (Ola 4, D3): notifica vencimiento de documentos de flota
-- al instructor con asignación activa sobre el vehículo y a todos los admins.
-- Reutiliza el mismo umbral (alert_config.advance_days) que ya usa DashboardAlertsFacade.

CREATE OR REPLACE FUNCTION notify_vehicle_document_expiry()
RETURNS void
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_advance_days INT;
  v_doc RECORD;
  v_instructor_user_id INT;
  v_admin RECORD;
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
      v.license_plate,
      CASE WHEN vd.expiry_date = CURRENT_DATE THEN 'expired' ELSE 'expiring_soon' END AS reason
    FROM public.vehicle_documents vd
    JOIN public.vehicles v ON v.id = vd.vehicle_id
    WHERE vd.expiry_date = CURRENT_DATE
       OR vd.expiry_date = CURRENT_DATE + (v_advance_days || ' days')::interval
  LOOP
    BEGIN
      IF v_doc.reason = 'expired' THEN
        v_subject := 'Documento vencido';
        v_message := v_doc.type || ' del vehículo ' || v_doc.license_plate || ' venció hoy.';
      ELSE
        v_subject := 'Documento por vencer';
        v_message := v_doc.type || ' del vehículo ' || v_doc.license_plate || ' vence en ' || v_advance_days || ' días.';
      END IF;

      v_instructor_user_id := NULL;
      SELECT i.user_id INTO v_instructor_user_id
      FROM public.vehicle_assignments va
      JOIN public.instructors i ON i.id = va.instructor_id
      WHERE va.vehicle_id = v_doc.vehicle_id AND va.end_date IS NULL
      LIMIT 1;

      IF v_instructor_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
        VALUES (v_instructor_user_id, 'system', v_subject, v_message, 'document_expiry', v_doc.vehicle_id, false, true);
      END IF;

      FOR v_admin IN
        SELECT u.id FROM public.users u
        JOIN public.roles r ON r.id = u.role_id
        WHERE r.name = 'admin' AND u.active = true
      LOOP
        INSERT INTO public.notifications (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
        VALUES (v_admin.id, 'system', v_subject, v_message, 'document_expiry', v_doc.vehicle_id, false, true);
      END LOOP;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_vehicle_document_expiry error (document_id=%): %', v_doc.id, SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule(
  'notify-vehicle-document-expiry',
  '0 6 * * *',
  $$SELECT notify_vehicle_document_expiry()$$
);
