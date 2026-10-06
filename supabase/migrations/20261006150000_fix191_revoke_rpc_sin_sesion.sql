-- ============================================================================
-- Fix 191-b (P0): funciones que escriben se podían ejecutar sin iniciar sesión
--
-- Postgres da EXECUTE a PUBLIC sobre toda función nueva y 20260513000002 lo extiende a anon y
-- authenticated: 12 funciones SECURITY DEFINER que escriben (y get_next_enrollment_number) se
-- podían llamar por /rest/v1/rpc solo con la anon key pública. Probado en fix-190-b:
-- confirm_enrollment_with_payment, como anon, activó un borrador con un "pago" de $1.
--
-- Quién las llama de verdad: el cron corre como postgres (dueño, no necesita GRANT); las edge
-- functions con service_role; la app solo llama confirm_enrollment_with_payment,
-- apply_class_b_absence_penalty y get_next_enrollment_number.
-- ============================================================================

-- 1. Cron / internas: nadie por API salvo service_role ------------------------------------------
REVOKE EXECUTE ON FUNCTION public.mark_end_of_day_class_b_absences()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_drafts()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_public_enrollment()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_public_enrollment_throttle()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_transition_promotion_status()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_transition_standalone_course_status()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_transition_theory_cycle_status()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_theory_cycle(integer, date)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_vehicle_document_expiry()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_instructor_monthly_hours(integer, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mark_end_of_day_class_b_absences()          TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_drafts()                    TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_public_enrollment()         TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_public_enrollment_throttle()        TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_transition_promotion_status()          TO service_role;  -- edge auto-create-next-promotions
GRANT EXECUTE ON FUNCTION public.auto_transition_standalone_course_status()  TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_transition_theory_cycle_status()       TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_theory_cycle(integer, date)          TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_vehicle_document_expiry()            TO service_role;
GRANT EXECUTE ON FUNCTION public.recalc_instructor_monthly_hours(integer, text) TO service_role;

-- 2. Llamadas desde la app: fuera anon; adentro, validación de rol y sede -----------------------
REVOKE EXECUTE ON FUNCTION public.get_next_enrollment_number(integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_next_enrollment_number(integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.confirm_enrollment_with_payment(integer, text, integer, integer, integer, integer, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.confirm_enrollment_with_payment(integer, text, integer, integer, integer, integer, boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.apply_class_b_absence_penalty(integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.apply_class_b_absence_penalty(integer) TO authenticated, service_role;

-- 2a. confirm_enrollment_with_payment: misma lógica + validación de quién llama + search_path (DG-063)
CREATE OR REPLACE FUNCTION public.confirm_enrollment_with_payment(
  p_enrollment_id   integer,
  p_payment_method  text,
  p_total_amount    integer,
  p_discount_id     integer DEFAULT NULL,
  p_discount_amount integer DEFAULT 0,
  p_registered_by   integer DEFAULT NULL,
  p_is_deposit      boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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

  -- 5. Insertar pago
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
    CASE WHEN v_is_pending THEN NULL ELSE CURRENT_DATE END,
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
$$;

-- 2b. apply_class_b_absence_penalty: lógica de spec 0048-b + validación de quién llama
CREATE OR REPLACE FUNCTION public.apply_class_b_absence_penalty(p_enrollment_id INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_branch_id       INT;
  v_role            TEXT;
  v_enabled         BOOLEAN;
  v_since           TIMESTAMPTZ;
  v_cancelled_count INT;
BEGIN
  SELECT e.branch_id INTO v_branch_id FROM public.enrollments e WHERE e.id = p_enrollment_id;

  -- fix-191-b: desde la app, solo admin o secretaria de la sede. Desde el cron
  -- (mark_end_of_day_class_b_absences, sin sesión) no hay usuario que validar.
  IF auth.uid() IS NOT NULL THEN
    v_role := public.auth_user_role();
    IF NOT (v_role = 'admin' OR (v_role = 'secretary' AND public.branch_visible(v_branch_id))) THEN
      RAISE EXCEPTION 'No tienes permiso para aplicar la penalización de esta matrícula.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Spec 0048-b: sin sede, sin fila de configuración o desactivada → -1, sin tocar nada.
  SELECT c.auto_cancel_enabled, c.enabled_since
    INTO v_enabled, v_since
  FROM public.branch_absence_penalty_config c
  WHERE c.branch_id = v_branch_id;

  IF NOT COALESCE(v_enabled, false) OR v_since IS NULL THEN
    RETURN -1;
  END IF;

  WITH cancelled AS (
    UPDATE public.class_b_sessions cs
    SET    status       = 'cancelled',
           cancelled_at = NOW()
    WHERE  cs.enrollment_id = p_enrollment_id
      AND  cs.status        = 'scheduled'
      AND  cs.class_number BETWEEN 1 AND 12
      AND EXISTS (
        SELECT 1
        FROM public.class_b_sessions cs1
        JOIN public.class_b_practice_attendance cba1
          ON cba1.class_b_session_id = cs1.id
         AND cba1.archived_at IS NULL
        JOIN public.class_b_sessions cs2
          ON cs2.enrollment_id = cs1.enrollment_id
         AND cs2.class_number   = cs1.class_number + 1
        JOIN public.class_b_practice_attendance cba2
          ON cba2.class_b_session_id = cs2.id
         AND cba2.archived_at IS NULL
        WHERE cs1.enrollment_id = p_enrollment_id
          AND cba1.status IN ('absent', 'no_show')
          AND cba2.status IN ('absent', 'no_show')
          AND cba1.recorded_at >= v_since
          AND cba2.recorded_at >= v_since
      )
    RETURNING cs.id
  )
  SELECT COUNT(*) INTO v_cancelled_count FROM cancelled;

  RETURN v_cancelled_count;
END;
$$;
