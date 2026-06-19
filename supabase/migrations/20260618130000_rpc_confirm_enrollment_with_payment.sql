-- RPC: confirm_enrollment_with_payment
--
-- Consolida en una sola transacción de BD lo que antes eran dos llamadas
-- independientes desde el cliente (recordPayment + confirmEnrollment).
-- Elimina la ventana de fallo entre ambas operaciones: o todo ocurre, o nada.
--
-- Orden de operaciones:
--   1. Validar enrollment (status = 'draft', bloqueo FOR UPDATE anti-doble-clic)
--   2. Generar número de matrícula via get_next_enrollment_number()
--   3. Calcular totales (total_paid, pending_balance, payment_status)
--   4. Limpiar pagos anteriores (idempotencia, seguro para back-button)
--   5. INSERT INTO payments
--   6. INSERT INTO discount_applications (si aplica)
--   7. UPDATE enrollments → status 'active', number, totales, expires_at = NULL
--   8. UPDATE class_b_sessions → 'reserved' a 'scheduled'
--
-- Retorna: TEXT con el número de matrícula generado
-- Lanza:   EXCEPTION si el enrollment no existe o ya fue procesado

CREATE OR REPLACE FUNCTION public.confirm_enrollment_with_payment(
  p_enrollment_id   INTEGER,
  p_payment_method  TEXT,     -- 'efectivo' | 'transferencia' | 'tarjeta' | 'pendiente'
  p_total_amount    INTEGER,  -- monto cobrado tras descuento
  p_discount_id     INTEGER  DEFAULT NULL,
  p_discount_amount INTEGER  DEFAULT 0,
  p_registered_by   INTEGER  DEFAULT NULL,
  p_is_deposit      BOOLEAN  DEFAULT FALSE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_course_id       INTEGER;
  v_base_price      INTEGER;
  v_enrollment_no   TEXT;
  v_is_pending      BOOLEAN;
  v_total_paid      INTEGER;
  v_payment_status  TEXT;
  v_pending_balance INTEGER;
BEGIN
  -- 1. Leer y validar el enrollment (FOR UPDATE previene doble confirmación concurrente)
  SELECT course_id, base_price
  INTO v_course_id, v_base_price
  FROM public.enrollments
  WHERE id = p_enrollment_id AND status = 'draft'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Enrollment % no encontrado o ya fue procesado. Recarga la página.',
      p_enrollment_id;
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
    enrollment_id,
    type,
    total_amount,
    cash_amount,
    transfer_amount,
    card_amount,
    voucher_amount,
    status,
    payment_date,
    requires_receipt,
    registered_by
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
    INSERT INTO public.discount_applications (
      discount_id,
      enrollment_id,
      discount_amount,
      applied_by
    ) VALUES (
      p_discount_id,
      p_enrollment_id,
      p_discount_amount,
      p_registered_by
    );
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
  UPDATE public.class_b_sessions SET
    status = 'scheduled'
  WHERE enrollment_id = p_enrollment_id
    AND status = 'reserved';

  RETURN v_enrollment_no;
END;
$$;
