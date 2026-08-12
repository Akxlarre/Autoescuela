-- Fix 153-m: FlotaFacade.upsertVehicleDocument() hace
-- `.upsert(payload, { onConflict: 'vehicle_id,type' })`, pero no existía ninguna constraint
-- UNIQUE/EXCLUDE sobre esas columnas — Postgres exige que el target de ON CONFLICT coincida
-- con una constraint real, así que ese upsert fallaba en el 100% de los casos ("there is no
-- unique or exclusion constraint matching the ON CONFLICT specification"). Sin esto, el
-- formulario nuevo del drawer de documentos de vehículo no podría guardar nada.

ALTER TABLE vehicle_documents
  ADD CONSTRAINT vehicle_documents_vehicle_id_type_key UNIQUE (vehicle_id, type);
