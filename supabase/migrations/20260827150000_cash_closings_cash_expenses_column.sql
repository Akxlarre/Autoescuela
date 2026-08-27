-- fix-226-m: el detalle del Historial de Cuadratura mostraba el egreso total del día
-- (todos los métodos de pago) como si todo afectara el arqueo físico. Solo los egresos
-- pagados en efectivo salen de la caja (ver fix-211-m). `cash_expenses` guarda ese
-- subtotal como snapshot al momento del cierre, para que el historial y los reportes
-- puedan separar "egreso efectivo" (afecta arqueo) de "egreso tarjeta/transferencia"
-- (no afecta arqueo) sin depender de una identidad algebraica frágil sobre `balance`.
--
-- Nullable a propósito: las filas cerradas antes de este fix no tienen el dato; el
-- cliente cae a un fallback derivado (opening_amount + cash_amount - balance) para esas.
ALTER TABLE cash_closings
  ADD COLUMN IF NOT EXISTS cash_expenses INTEGER;
