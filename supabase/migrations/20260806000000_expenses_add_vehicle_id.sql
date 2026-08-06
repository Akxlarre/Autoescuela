-- Documenta una columna que ya existe en producción (aplicada manualmente, sin
-- migración versionada — ver ASG-b-037 / spec 0002-i). IF NOT EXISTS la vuelve
-- segura de correr en cualquier entorno, incluidos los que aún no la tienen.
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS vehicle_id INT REFERENCES vehicles(id);

COMMENT ON COLUMN expenses.vehicle_id IS 'Vehículo asociado al egreso (ej. carga de combustible). Opcional.';
