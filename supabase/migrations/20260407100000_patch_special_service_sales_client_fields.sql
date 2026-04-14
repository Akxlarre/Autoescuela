-- ============================================================================
-- PATCH: special_service_sales — Soporte para clientes externos (RF-037)
-- ============================================================================
-- El diseño original asumía que toda venta era a un alumno registrado.
-- RF-037 requiere vender a clientes externos (empresas, particulares).
-- Se flexibiliza student_id y se agregan campos de cliente y estado de cobro.
-- ============================================================================

-- 1. Hacer student_id opcional (clientes externos no tienen FK a students)
ALTER TABLE special_service_sales
  ALTER COLUMN student_id DROP NOT NULL;

-- 2. Agregar campos de cliente externo
ALTER TABLE special_service_sales
  ADD COLUMN IF NOT EXISTS is_student  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS client_rut  TEXT;

-- 3. Agregar estado de la venta y cobro
ALTER TABLE special_service_sales
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT special_service_sales_status_check
    CHECK (status IN ('completed', 'pending')),
  ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT false;

-- 4. Comentarios descriptivos
COMMENT ON COLUMN special_service_sales.is_student   IS 'true = alumno registrado en la escuela, false = cliente externo';
COMMENT ON COLUMN special_service_sales.client_name  IS 'Nombre del cliente (usado cuando is_student = false o student_id es nulo)';
COMMENT ON COLUMN special_service_sales.client_rut   IS 'RUT del cliente en formato 12.345.678-9';
COMMENT ON COLUMN special_service_sales.status       IS 'Estado de la prestación del servicio: pending | completed';
COMMENT ON COLUMN special_service_sales.paid         IS 'true = cobro registrado, false = pendiente de cobro';
