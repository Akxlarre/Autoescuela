-- Spec 0024-m (ASG-i-054): los objetos vigentes que derivaban el día de negocio con la zona de
-- la sesión (UTC) pasan a public.chile_today().
--
-- Cada definición se copió de la BD (pg_get_functiondef / pg_policies / pg_views, 2026-10-09),
-- no de la historia de migraciones; el único cambio es de dónde sale "hoy". Requiere
-- 20261009120000_time_fn_chile_today.sql.
--
-- Queda fuera, como excepción declarada: el CHECK students.chk_minimum_age
-- (birth_date <= hoy - 17 años). Un CHECK no debe depender de una función no inmutable y el
-- desfase posible es de horas sobre 17 años.
--
-- Idempotente: CREATE OR REPLACE y DROP POLICY IF EXISTS + CREATE POLICY.

-- ── 1. Transiciones automáticas (pg_cron 06:00 UTC) ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_transition_promotion_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_today date := public.chile_today();
BEGIN
  -- in_progress → finished: la fecha de término ya pasó
  UPDATE public.professional_promotions
  SET    status     = 'finished',
         updated_at = NOW()
  WHERE  status   = 'in_progress'
    AND  end_date < v_today;

  -- planned → in_progress: la fecha de inicio llegó y el curso aún no terminó
  UPDATE public.professional_promotions
  SET    status     = 'in_progress',
         updated_at = NOW()
  WHERE  status     = 'planned'
    AND  start_date <= v_today
    AND  end_date   >= v_today;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_transition_standalone_course_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.standalone_courses
  SET    status     = 'active',
         updated_at = NOW()
  WHERE  status     = 'upcoming'
    AND  start_date <= public.chile_today();
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_transition_theory_cycle_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.class_b_theory_cycles
  SET    status = 'finished'
  WHERE  status   = 'active'
    AND  end_date < public.chile_today();
END;
$function$;

-- ── 2. Triggers de vencimiento ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.calculate_vehicle_document_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_today date := public.chile_today();
BEGIN
  IF NEW.expiry_date < v_today THEN
    NEW.status := 'expired';
  ELSIF NEW.expiry_date <= v_today + 30 THEN
    NEW.status := 'expiring_soon';
  ELSE
    NEW.status := 'valid';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_license_alert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_today date := public.chile_today();
BEGIN
  IF NEW.license_expiry <= v_today + 30 THEN
    NEW.license_status := 'expiring_soon';
  END IF;
  IF NEW.license_expiry < v_today THEN
    NEW.license_status := 'expired';
  END IF;
  RETURN NEW;
END;
$function$;

-- ── 3. Aviso de documentos de vehículo por vencer (pg_cron 06:00 UTC) ────────────────────────

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
      CASE WHEN vd.expiry_date = v_today THEN 'expired' ELSE 'expiring_soon' END AS reason
    FROM public.vehicle_documents vd
    JOIN public.vehicles v ON v.id = vd.vehicle_id
    WHERE vd.expiry_date = v_today
       OR vd.expiry_date = v_today + v_advance_days
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
$function$;

-- ── 4. RPC confirmar matrícula con pago: payment_date es el día de Chile ─────────────────────
-- CREATE OR REPLACE conserva los permisos vigentes (fix-191-b: sin EXECUTE para anon).

CREATE OR REPLACE FUNCTION public.confirm_enrollment_with_payment(
  p_enrollment_id integer,
  p_payment_method text,
  p_total_amount integer,
  p_discount_id integer DEFAULT NULL::integer,
  p_discount_amount integer DEFAULT 0,
  p_registered_by integer DEFAULT NULL::integer,
  p_is_deposit boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_course_id       INTEGER;
  v_base_price      INTEGER;
  v_branch_id       INTEGER;
  v_role            TEXT;
  v_enrollment_no   TEXT;
  v_is_pending      BOOLEAN;
  v_total_paid      INTEGER;
  v_payment_status  TEXT;
  v_pending_balance INTEGER;
BEGIN
  -- 1. Leer y validar el enrollment (FOR UPDATE previene doble confirmación concurrente)
  SELECT course_id, base_price, branch_id
  INTO v_course_id, v_base_price, v_branch_id
  FROM public.enrollments
  WHERE id = p_enrollment_id AND status = 'draft'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Enrollment % no encontrado o ya fue procesado. Recarga la página.',
      p_enrollment_id;
  END IF;

  -- fix-191-b: un usuario solo confirma si es admin, o secretaria de la sede de la matrícula
  -- (o con grant multi-sede). Sin sesión (service_role / postgres) no hay usuario que validar:
  -- anon ya no tiene EXECUTE.
  IF auth.uid() IS NOT NULL THEN
    v_role := public.auth_user_role();
    IF NOT (v_role = 'admin' OR (v_role = 'secretary' AND public.branch_visible(v_branch_id))) THEN
      RAISE EXCEPTION 'No tienes permiso para confirmar esta matrícula.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 2. Generar número de matrícula
  SELECT public.get_next_enrollment_number(v_course_id) INTO v_enrollment_no;

  -- 3. Calcular totales
  v_is_pending      := p_payment_method = 'pendiente';
  v_total_paid      := CASE WHEN v_is_pending THEN 0 ELSE p_total_amount END;
  v_pending_balance := v_base_price - p_discount_amount - v_total_paid;
  v_payment_status  := CASE
    WHEN v_is_pending  THEN 'pending'
    WHEN p_is_deposit  THEN 'partial'
    ELSE 'paid_full'
  END;

  -- 4. Idempotencia: limpiar registros anteriores (back-button safe)
  DELETE FROM public.discount_applications WHERE enrollment_id = p_enrollment_id;
  DELETE FROM public.payments
    WHERE enrollment_id = p_enrollment_id AND type = 'enrollment';

  -- 5. Insertar pago (spec 0024-m: payment_date es el día de Chile, no el de UTC)
  INSERT INTO public.payments (
    enrollment_id, type, total_amount, cash_amount, transfer_amount, card_amount,
    voucher_amount, status, payment_date, requires_receipt, registered_by
  ) VALUES (
    p_enrollment_id,
    'enrollment',
    p_total_amount,
    CASE WHEN p_payment_method = 'efectivo'      THEN p_total_amount ELSE 0 END,
    CASE WHEN p_payment_method = 'transferencia' THEN p_total_amount ELSE 0 END,
    CASE WHEN p_payment_method = 'tarjeta'       THEN p_total_amount ELSE 0 END,
    0,
    CASE WHEN v_is_pending THEN 'pending' ELSE 'paid' END,
    CASE WHEN v_is_pending THEN NULL ELSE public.chile_today() END,
    TRUE,
    p_registered_by
  );

  -- 6. Insertar descuento si aplica
  IF p_discount_id IS NOT NULL AND p_discount_amount > 0 THEN
    INSERT INTO public.discount_applications (discount_id, enrollment_id, discount_amount, applied_by)
    VALUES (p_discount_id, p_enrollment_id, p_discount_amount, p_registered_by);
  END IF;

  -- 7. Activar enrollment
  UPDATE public.enrollments SET
    status          = 'active',
    number          = v_enrollment_no,
    discount        = p_discount_amount,
    total_paid      = v_total_paid,
    pending_balance = v_pending_balance,
    payment_status  = v_payment_status,
    registered_by   = p_registered_by,
    expires_at      = NULL,
    updated_at      = NOW()
  WHERE id = p_enrollment_id;

  -- 8. Confirmar sesiones reservadas → agendadas
  UPDATE public.class_b_sessions SET status = 'scheduled'
  WHERE enrollment_id = p_enrollment_id AND status = 'reserved';

  RETURN v_enrollment_no;
END;
$function$;

-- ── 5. RLS: ventana de cierres de caja de la secretaria (AC11) ───────────────────────────────
-- Misma policy (SELECT, rol public); la ventana de 2 días se cuenta desde el hoy de Chile.

DROP POLICY IF EXISTS select_cash_closings ON public.cash_closings;
CREATE POLICY select_cash_closings ON public.cash_closings
  FOR SELECT
  USING (
    public.auth_user_role() = 'admin'
    OR (
      public.auth_user_role() = 'secretary'
      AND date >= (SELECT public.chile_today()) - 2
      AND public.branch_visible(branch_id)
    )
  );

-- ── 6. Vista de disponibilidad de agenda Clase B ─────────────────────────────────────────────
-- Idéntica a la de fix-196-b salvo el origen de los días: hoy (Chile) + 0..28, en vez de una
-- serie que partía del día UTC. De noche la serie partía un día después y perdía "hoy".

CREATE OR REPLACE VIEW public.v_class_b_schedule_availability AS
WITH
course_slots AS (
  SELECT DISTINCT ON (c.branch_id, (b.value ->> 'from')::TIME)
    c.branch_id,
    c.schedule_days,
    (b.value ->> 'from')::TIME AS slot_from,
    (b.value ->> 'to')::TIME   AS slot_to
  FROM courses c,
       LATERAL jsonb_array_elements(c.schedule_blocks) AS b(value)
  WHERE c.type = 'class_b'
    AND c.active = true
  ORDER BY c.branch_id, (b.value ->> 'from')::TIME
),
slots AS (
  SELECT
    i.id        AS instructor_id,
    va.vehicle_id,
    (days.d + cs.slot_from) AT TIME ZONE 'America/Santiago' AS slot_start,
    (days.d + cs.slot_to)   AT TIME ZONE 'America/Santiago' AS slot_end
  FROM instructors i
  JOIN users u
    ON u.id = i.user_id
  JOIN vehicle_assignments va
    ON va.instructor_id = i.id
   AND va.end_date IS NULL
  JOIN course_slots cs
    ON cs.branch_id = u.branch_id OR i.both_branches
  JOIN vehicles v
    ON v.id = va.vehicle_id
   AND (v.branch_id = cs.branch_id OR v.both_branches)
  CROSS JOIN LATERAL (
    SELECT (SELECT public.chile_today()) + n AS d
    FROM generate_series(0, 28) AS n
  ) AS days
  WHERE
    i.active = true
    AND (i.type IS NULL OR i.type != 'theory')
    AND EXTRACT(ISODOW FROM days.d)::INT = ANY(cs.schedule_days)
),
-- Sin MATERIALIZED (hotfix-003-i). El choque, en la función SECURITY DEFINER (fix-196-b).
slot_availability AS (
  SELECT
    s.*,
    NOT public.class_b_slot_occupied(s.instructor_id, s.vehicle_id, s.slot_start, s.slot_end)
      AS is_available
  FROM slots s
)
SELECT
  instructor_id,
  vehicle_id,
  slot_start,
  slot_end,
  CASE WHEN is_available THEN 'available' ELSE 'occupied' END AS slot_status
FROM slot_availability;

ALTER VIEW public.v_class_b_schedule_availability SET (security_invoker = true);

COMMENT ON VIEW public.v_class_b_schedule_availability IS
  'Slots de 45 min (disponibles Y ocupados) por instructor+vehículo en las próximas 4 semanas. '
  'Columna slot_status = ''available'' | ''occupied'' indica disponibilidad real. '
  'Zona horaria: America/Santiago explícita; spec 0024-m: los días parten de chile_today(), no '
  'del día UTC de la sesión. '
  'Spec 0004-m: un instructor con both_branches=true genera filas para las dos sedes '
  '(join de course_slots ya no ancla solo a su sede); el vehículo asignado debe cubrir '
  'la sede del slot (v.branch_id = cs.branch_id OR v.both_branches) — si el vehículo del '
  'instructor no es both_branches, la sede que no cubre queda sin filas (no "occupied", '
  'ausente). El conflicto de instructor/vehículo es global, sin filtro de sede: un '
  'instructor u vehículo ocupado en una sede ya bloquea el mismo horario en la otra. '
  'Excluye instructores con type=''theory''. Solo incluye el vehículo activo del instructor. '
  'Fix-032-i: el conflicto se computa con un solo chequeo (instructor OR vehículo). '
  'Hotfix-003-i: SIN MATERIALIZED en el CTE (causaba timeout 57014 al bloquear el pushdown del '
  'filtro de fecha). Fix-196-b: el conflicto se calcula en class_b_slot_occupied() SECURITY '
  'DEFINER — con security_invoker la RLS se evaluaba fila por fila (~5 s por semana) y ocultaba '
  'las clases de la otra sede.';
