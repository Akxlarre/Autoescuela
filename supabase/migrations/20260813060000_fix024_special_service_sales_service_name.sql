-- Fix 024-i: un servicio del Catálogo (service_catalog) desactivado por fix-022-i puede
-- necesitar borrarse definitivamente. special_service_sales.service_id era NOT NULL
-- REFERENCES service_catalog(id) sin ON DELETE CASCADE, así que un DELETE del catálogo con
-- ventas asociadas quedaba bloqueado sin ninguna vía de escape real.
--
-- En vez de permitir un DELETE en cascada (perdería historial financiero real — mismo
-- criterio que ASG-b-037/DG-065: nunca tocar el pasado financiero en silencio), el borrado
-- definitivo desvincula las ventas (service_id = NULL) y las conserva. Para que el Historial
-- no pierda el nombre del servicio cuando ya no hay fila de catálogo a la que unir, se
-- denormaliza un snapshot del nombre en la propia venta.

ALTER TABLE special_service_sales ALTER COLUMN service_id DROP NOT NULL;
ALTER TABLE special_service_sales ADD COLUMN IF NOT EXISTS service_name TEXT;

UPDATE special_service_sales sss
SET service_name = sc.name
FROM service_catalog sc
WHERE sss.service_id = sc.id AND sss.service_name IS NULL;
