-- ============================================================================
-- fix-050-i — Pago del paso "Pago" del wizard de matrícula sin duplicados
-- ============================================================================
-- EnrollmentPaymentFacade.recordPayment() reemplazaba el pago anterior con DELETE sueltos sobre
-- discount_applications y payments. La RLS no le da DELETE a la secretaria (protege el historial)
-- y PostgREST responde a ese DELETE sin error y con 0 filas: el INSERT siguiente duplicaba el
-- pago de matrícula (evidencia: matrícula 7003).
--
-- En vez de abrir DELETE a la secretaria, el reemplazo lo hace esta RPC, igual que
-- confirm_enrollment_with_payment():
--   - solo matrículas en 'draft' (una matrícula activa no se toca);
--   - solo admin, o secretaria de la sede de la matrícula (mismo chequeo que fix-191-b);
--   - DELETE + INSERT del pago y del descuento, en una transacción; los totales los recalcula
--     el trigger de payments, como en cualquier otro pago;
--   - payment_date = public.chile_today() y registered_by / applied_by = usuario de la sesión.
-- Idempotente: CREATE OR REPLACE + REVOKE/GRANT.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_enrollment_payment(
  p_enrollment_id   integer,
  p_payment_method  text,
  p_total_amount    integer,
  p_discount_id     integer DEFAULT NULL,
  p_discount_amount integer DEFAULT 0,
  p_is_deposit      boolean DEFAULT false,  -- solo informativo: el estado lo calcula el trigger
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

  IF p_payment_method IS NULL
     OR p_payment_method NOT IN ('efectivo', 'transferencia', 'tarjeta', 'pendiente') THEN
    RAISE EXCEPTION 'Medio de pago inválido: %', p_payment_method;
  END IF;

  v_is_pending := p_payment_method = 'pendiente';

  -- 3. El descuento nuevo va primero: recalculate_enrollment_balance() (trigger de payments)
  --    calcula el saldo con enrollments.discount, y check_payment_within_pending_balance()
  --    compara el pago con ese saldo. Con el descuento viejo, quitar o bajar el descuento al
  --    volver al paso Pago rechazaría un pago correcto.
  UPDATE public.enrollments SET discount = v_discount WHERE id = p_enrollment_id;

  -- 4. Reemplaza el pago y el descuento anteriores (volver al paso Pago no duplica)
  DELETE FROM public.discount_applications WHERE enrollment_id = p_enrollment_id;
  DELETE FROM public.payments WHERE enrollment_id = p_enrollment_id AND type = 'enrollment';

  -- 5. Pago (spec 0024-m: payment_date es el día de Chile)
  INSERT INTO public.payments (
    enrollment_id, type, total_amount, cash_amount, transfer_amount, card_amount,
    voucher_amount, status, payment_date, requires_receipt, registered_by, document_number
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
    v_user_id,
    NULLIF(btrim(p_document_number), '')
  );

  -- 6. Descuento aplicado, si corresponde
  IF p_discount_id IS NOT NULL AND v_discount > 0 THEN
    INSERT INTO public.discount_applications (discount_id, enrollment_id, discount_amount, applied_by)
    VALUES (p_discount_id, p_enrollment_id, v_discount, v_user_id);
  END IF;

  -- total_paid, pending_balance y payment_status los deja recalculate_enrollment_balance() al
  -- insertar el pago (la matrícula sigue en borrador: se activa al firmar el contrato, fix-034-i).
END;
$function$;

COMMENT ON FUNCTION public.record_enrollment_payment(integer, text, integer, integer, integer, boolean, text) IS
  'Reemplaza el pago de matrícula (y su descuento) de una matrícula en borrador en una transacción (los totales los recalcula el trigger de payments). Admin o secretaria de la sede. fix-050-i.';

REVOKE EXECUTE ON FUNCTION public.record_enrollment_payment(integer, text, integer, integer, integer, boolean, text)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.record_enrollment_payment(integer, text, integer, integer, integer, boolean, text)
  TO authenticated, service_role;
