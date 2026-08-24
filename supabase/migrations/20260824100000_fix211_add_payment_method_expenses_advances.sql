-- fix-211-m: agrega payment_method a expenses e instructor_advances.
-- Sin esta columna, el arqueo de caja física asumía que el 100% de los egresos
-- se pagó en efectivo, aunque haya sido por transferencia o tarjeta de la empresa.
-- Default 'efectivo' preserva el comportamiento anterior para filas existentes.

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'efectivo'
    CHECK (payment_method IN ('efectivo', 'transferencia', 'tarjeta'));

ALTER TABLE instructor_advances
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'efectivo'
    CHECK (payment_method IN ('efectivo', 'transferencia', 'tarjeta'));
