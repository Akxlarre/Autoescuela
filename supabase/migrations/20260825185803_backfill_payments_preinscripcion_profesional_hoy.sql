-- fix-213-m / fix-214-m: backfill puntual de `payments` para matrículas creadas hoy
-- desde el flujo de conversión de pre-inscripción profesional (admin), que quedaron
-- sin fila de pago por el bug corregido en fix-213-m (completarMatricula() no
-- insertaba en `payments`, por eso no aparecían en Cuadratura de Caja).
--
-- Idempotente: solo toca enrollments de HOY, canal 'in_person', con plata cobrada
-- (total_paid > 0) y que todavía NO tengan ninguna fila en `payments`.
--
-- ⚠️ Asume que el método de pago fue EFECTIVO (es el caso reportado). Si hay más de
-- una fila afectada y alguna no fue en efectivo, corregir el método a mano antes de
-- correr el paso 3 (ver diagnóstico abajo).
--
-- El trigger BEFORE INSERT check_payment_within_pending_balance() (fix-057-m/H-024)
-- rechaza un pago si supera enrollments.pending_balance vigente — como estos
-- enrollments ya quedaron con pending_balance = 0 (calculado a mano en el bug
-- original), insertar el pago directo choca con ese trigger. Por eso el paso 2
-- resetea el enrollment al estado "sin pagar" antes del insert; el trigger AFTER
-- INSERT recalculate_enrollment_balance() recalcula total_paid/pending_balance/
-- payment_status automáticamente al insertar el pago en el paso 3.

-- 1. Diagnóstico — correr esto primero y revisar antes de seguir.
--    Si aparece más de una fila, confirmar el método de pago real de cada una.
SELECT
  e.id AS enrollment_id,
  e.number,
  e.total_paid,
  e.pending_balance,
  e.payment_status,
  e.registered_by,
  e.created_at
FROM enrollments e
WHERE e.registration_channel = 'in_person'
  AND e.created_at::date = CURRENT_DATE
  AND e.total_paid > 0
  AND NOT EXISTS (
    SELECT 1 FROM payments p WHERE p.enrollment_id = e.id
  );

-- 2. Resetear al estado "sin pagar" (solo las filas afectadas) para que el trigger
--    de saldo pendiente no bloquee el insert del paso 3.
UPDATE enrollments e
SET total_paid = 0,
    pending_balance = e.base_price - e.discount,
    payment_status = 'pending'
WHERE e.registration_channel = 'in_person'
  AND e.created_at::date = CURRENT_DATE
  AND e.total_paid > 0
  AND NOT EXISTS (
    SELECT 1 FROM payments p WHERE p.enrollment_id = e.id
  );

-- 3. Backfill — inserta la fila de pago faltante asumiendo efectivo. El trigger
--    AFTER INSERT recalcula total_paid/pending_balance/payment_status del enrollment.
INSERT INTO payments (
  enrollment_id, type, total_amount, cash_amount, transfer_amount,
  card_amount, voucher_amount, status, payment_date, requires_receipt, registered_by
)
SELECT
  e.id,
  'enrollment',
  e.base_price - e.discount, -- monto que quedó "sin pagar" tras el reset del paso 2
  e.base_price - e.discount, -- asume efectivo
  0,
  0,
  0,
  'paid',
  e.created_at::date,
  TRUE,
  e.registered_by
FROM enrollments e
WHERE e.registration_channel = 'in_person'
  AND e.created_at::date = CURRENT_DATE
  AND e.payment_status = 'pending'
  AND e.base_price - e.discount > 0
  AND NOT EXISTS (
    SELECT 1 FROM payments p WHERE p.enrollment_id = e.id
  );
