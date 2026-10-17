-- ============================================================================
-- fix-057-i — Una matrícula con beca del 100 % se confirma sin registrar un pago de $0
-- ============================================================================
-- Con un descuento que cubre todo el monto, el paso Pago mandaba un pago de $0 y el INSERT
-- chocaba con chk_positive_amount (total_amount > 0): la matrícula no avanzaba.
-- Decisión de negocio (2026-10-16): no se registra ningún pago; la beca queda como descuento
-- aplicado y la matrícula con saldo 0 y estado 'paid_full'.
--
-- Cambios sobre record_enrollment_payment() (fix-050-i):
--   - Con p_total_amount = 0 no hay INSERT del pago y el medio de pago es opcional.
--   - Al final se recalculan los totales con la misma regla que recalculate_enrollment_balance():
--     sin INSERT en payments ese trigger no corre (y si no había pago previo, el DELETE tampoco).
-- Idempotente: CREATE OR REPLACE + REVOKE/GRANT.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_enrollment_payment(
  p_enrollment_id   integer,
  p_payment_method  text,
  p_total_amount    integer,
  p_discount_id     integer DEFAULT NULL,
  p_discount_amount integer DEFAULT 0,
  p_is_deposit      boolean DEFAULT false,  -- solo informativo: el estado lo calcula el saldo
  p_document_number text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_branch_id  INTEGER;
  v_role       TEXT;
  v_user_id    INTEGER;
  v_is_pending BOOLEAN;
  v_discount   INTEGER := COALESCE(p_discount_amount, 0);
  v_total      INTEGER := COALESCE(p_total_amount, 0);
BEGIN
  -- 1. Solo una matrícula en borrador (FOR UPDATE: dos guardados simultáneos van en fila)
  SELECT branch_id INTO v_branch_id
  FROM public.enrollments
  WHERE id = p_enrollment_id AND status = 'draft'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La matrícula % ya no está en borrador: su pago no se puede reemplazar.',
      p_enrollment_id;
  END IF;

  -- 2. Permiso: admin, o secretaria de la sede de la matrícula. Sin sesión (service_role /
  --    postgres) no hay usuario que validar: anon no tiene EXECUTE.
  IF auth.uid() IS NOT NULL THEN
    v_role := public.auth_user_role();
    IF NOT (v_role = 'admin' OR (v_role = 'secretary' AND public.branch_visible(v_branch_id))) THEN
      RAISE EXCEPTION 'No tienes permiso para registrar el pago de esta matrícula.'
        USING ERRCODE = '42501';
    END IF;
    v_user_id := public.auth_user_id();
  END IF;

  IF v_total < 0 THEN
    RAISE EXCEPTION 'El monto a pagar no puede ser negativo.';
  END IF;

  -- fix-057-i: con monto 0 (beca que cubre todo) no hay medio de pago que validar.
  IF v_total > 0 AND (p_payment_method IS NULL
     OR p_payment_method NOT IN ('efectivo', 'transferencia', 'tarjeta', 'pendiente')) THEN
    RAISE EXCEPTION 'Medio de pago inválido: %', p_payment_method;
  END IF;

  v_is_pending := p_payment_method = 'pendiente';

  -- 3. El descuento nuevo va primero: recalculate_enrollment_balance() (trigger de payments)
  --    calcula el saldo con enrollments.discount, y check_payment_within_pending_balance()
  --    compara el pago con ese saldo.
  UPDATE public.enrollments SET discount = v_discount WHERE id = p_enrollment_id;

  -- 4. Reemplaza el pago y el descuento anteriores (volver al paso Pago no duplica)
  DELETE FROM public.discount_applications WHERE enrollment_id = p_enrollment_id;
  DELETE FROM public.payments WHERE enrollment_id = p_enrollment_id AND type = 'enrollment';

  -- 5. Pago (spec 0024-m: payment_date es el día de Chile). fix-057-i: sin pago si el monto es 0.
  IF v_total > 0 THEN
    INSERT INTO public.payments (
      enrollment_id, type, total_amount, cash_amount, transfer_amount, card_amount,
      voucher_amount, status, payment_date, requires_receipt, registered_by, document_number
    ) VALUES (
      p_enrollment_id,
      'enrollment',
      v_total,
      CASE WHEN p_payment_method = 'efectivo'      THEN v_total ELSE 0 END,
      CASE WHEN p_payment_method = 'transferencia' THEN v_total ELSE 0 END,
      CASE WHEN p_payment_method = 'tarjeta'       THEN v_total ELSE 0 END,
      0,
      CASE WHEN v_is_pending THEN 'pending' ELSE 'paid' END,
      CASE WHEN v_is_pending THEN NULL ELSE public.chile_today() END,
      TRUE,
      v_user_id,
      NULLIF(btrim(p_document_number), '')
    );
  END IF;

  -- 6. Descuento aplicado, si corresponde
  IF p_discount_id IS NOT NULL AND v_discount > 0 THEN
    INSERT INTO public.discount_applications (discount_id, enrollment_id, discount_amount, applied_by)
    VALUES (p_discount_id, p_enrollment_id, v_discount, v_user_id);
  END IF;

  -- 7. fix-057-i: totales con la misma regla que recalculate_enrollment_balance(). Sin INSERT ese
  --    trigger no corre; con INSERT deja el mismo resultado.
  UPDATE public.enrollments e SET
    total_paid      = s.paid,
    pending_balance = e.base_price - e.discount - s.paid,
    payment_status  = CASE
                        WHEN e.base_price - e.discount <= s.paid THEN 'paid_full'
                        WHEN s.paid > 0 THEN 'partial'
                        ELSE 'pending'
                      END,
    updated_at      = NOW()
  FROM (
    SELECT COALESCE(SUM(p.total_amount), 0) AS paid
    FROM public.payments p
    WHERE p.enrollment_id = p_enrollment_id AND p.status = 'paid'
  ) s
  WHERE e.id = p_enrollment_id;
END;
$function$;

COMMENT ON FUNCTION public.record_enrollment_payment(integer, text, integer, integer, integer, boolean, text) IS
  'Reemplaza el pago de matrícula (y su descuento) de una matrícula en borrador en una transacción. Con monto 0 (beca 100 %) no registra pago (fix-057-i). Admin o secretaria de la sede. fix-050-i.';

REVOKE EXECUTE ON FUNCTION public.record_enrollment_payment(integer, text, integer, integer, integer, boolean, text)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.record_enrollment_payment(integer, text, integer, integer, integer, boolean, text)
  TO authenticated, service_role;
