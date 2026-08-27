-- Spec 0012-m: persistir borrador de Arqueo y Cierre de Caja — columnas descubiertas durante
-- la implementación de la Facade. El fondo de apertura y el toggle "Realizar arqueo de
-- efectivo físico" no tenían dónde persistirse: ninguno se deriva de otra tabla (a diferencia
-- de ingresos/egresos, que ya viven en payments/expenses) y ninguna columna existente de
-- cash_closings representa ninguno de los dos.
ALTER TABLE cash_closings
  ADD COLUMN IF NOT EXISTS opening_amount INTEGER,
  ADD COLUMN IF NOT EXISTS arqueo_enabled BOOLEAN;
