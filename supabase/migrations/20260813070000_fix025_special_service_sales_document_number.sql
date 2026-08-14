-- Fix 025-i: agrega N° de boleta opcional a las ventas de Servicios Especiales.
-- Se propaga a Caja Diaria (IngresoRow.nBoleta) igual que payments.document_number.
-- Idempotente: ADD COLUMN IF NOT EXISTS.

ALTER TABLE special_service_sales ADD COLUMN IF NOT EXISTS document_number TEXT;
