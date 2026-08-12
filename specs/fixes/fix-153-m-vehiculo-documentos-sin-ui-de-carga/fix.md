# Fix: No existe UI para asignar/cargar documentos (SOAP, Revisión Técnica, etc.) a un vehículo
> id: fix-153-m-vehiculo-documentos-sin-ui-de-carga
> refs: docs/UAT-PLAN.md — Paquete 3 (bloqueo por SOAP vencido al agendar) y Paquete 5 (alertas de vencimiento)
> status: done
> closed: 2026-08-11
> created: 2026-08-11

## Root Cause
El drawer `VehicleDocumentsDrawerComponent`
(`src/app/features/admin/flota/vehicle-documents-drawer/vehicle-documents-drawer.component.ts`) es
**solo lectura**: lista `vehicle.documents` (SOAP, Revisión Técnica, Permiso de Circulación, Seguro)
con su estado vigente/vencido, pero no tiene ningún formulario, input de fecha de vencimiento ni
file upload — solo un botón "Ver documento" (línea 157-163) y el footer solo cierra el panel.

El método `FlotaFacade.upsertVehicleDocument()` (`core/facades/flota.facade.ts:264-270`) hace el
upsert correcto a `vehicle_documents`, pero **no lo llama ningún componente en todo `src/`** — es
lógica huérfana. `vehicle-form-drawer` (alta/edición de vehículo) tampoco lo cubre.

Consecuencia: no hay forma de cargar la fecha de vencimiento del SOAP de un vehículo salvo
insertándolo manualmente en la BD. Esto también deja huérfana, corriente abajo, la validación de
"bloquear agendamiento con vehículo con SOAP vencido" (Paquete 3) y las alertas de documentos por
vencer (Paquete 5) — ninguna de las dos tiene datos reales que consumir en un flujo normal de uso.

## ACs Afectados
Ninguno — fix autónomo, hallazgo de auditoría UAT (Paquetes 3 y 5), no ligado a una spec de negocio previa.

## Cambio
- **Archivo principal:** `src/app/features/admin/flota/vehicle-documents-drawer/vehicle-documents-drawer.component.ts`
  — reescrito de solo-lectura a formulario editable. Siempre muestra los 4 tipos canónicos (SOAP,
  Revisión Técnica, Permiso de Circulación, Seguro) aunque no tengan datos aún ("Sin cargar").
  Edición inline por fila: fecha de vencimiento (`app-date-input`, obligatoria — confirmado con el
  usuario que los 4 tipos la requieren, sin fecha el archivo no sirve para calcular vigencia) +
  adjunto opcional (PDF/JPG/PNG/WEBP, máx. 5MB, `validateDocumentFile()`). Botón "Ver documento"
  abre el archivo vía `DmsViewerService.openByUrl()` con signed URL (TTL 1h).
- **`FlotaFacade` (`core/facades/flota.facade.ts`):** `upsertVehicleDocument()` reescrito — antes
  hardcodeaba `status: 'valid'` sin importar la fecha real; ahora calcula el status con
  `resolveDocStatus()` (mismo cálculo que ya usaba el read-side). Ahora acepta `file?: File` y sube
  al bucket `documents` (`vehicle-docs/{vehicleId}/{timestamp}_{type}.{ext}`) antes del upsert si
  hay archivo nuevo; conserva `existingFilePath` si el usuario solo actualiza la fecha. Se agregó
  `getDocumentSignedUrl()` (signed URL, TTL 1h, mismo patrón que `DmsFacade`).
- **`VehicleDocSummary` (`core/models/ui/vehicle-table.model.ts`):** se agregó `filePath` — requirió
  actualizar también `FlotaFacade.fetchVehiclesData()` y `FlotaDetalleFacade.loadVehicleDetail()`
  (el otro consumidor del mismo modelo compartido) para seleccionar/mapear `file_url`, si no el
  build no compilaba.
- **Hallazgo bloqueante durante la implementación (no en el Root Cause original, pero necesario
  para que `upsertVehicleDocument()` funcionara):** `vehicle_documents` no tenía ninguna constraint
  `UNIQUE`/`EXCLUDE` sobre `(vehicle_id, type)`, y el método ya hacía
  `.upsert(payload, { onConflict: 'vehicle_id,type' })` — sin esa constraint Postgres rechaza
  cualquier upsert con "there is no unique or exclusion constraint matching the ON CONFLICT
  specification". El formulario nuevo habría fallado el 100% de las veces sin esto. Se agregó
  `supabase/migrations/20260811120000_fix153_vehicle_documents_unique_type.sql`
  (`ALTER TABLE ... ADD CONSTRAINT ... UNIQUE (vehicle_id, type)`) — verificado que no había filas
  duplicadas en remoto antes de escribirla.

## Test de Regresión
- **Facade (`flota.facade.spec.ts`, 6 tests nuevos, verde):** `upsertVehicleDocument()` sin archivo
  hace upsert con `existingFilePath` y status calculado desde `expiryDate`; con archivo sube primero
  a storage y usa el path nuevo; calcula `status='expired'` con fecha pasada; propaga el error y NO
  muestra toast de éxito si el upsert falla. `getDocumentSignedUrl()` devuelve la signed URL o
  `null` si Storage responde error.
- **Constraint + upsert real, verificado contra la BD remota** (`supabase db query --linked`, dentro
  de `BEGIN...ROLLBACK`, sin dejar datos): confirmado que no había `(vehicle_id, type)` duplicados
  (la `ADD CONSTRAINT` no habría podido aplicarse si los hubiera), que la constraint se crea sin
  error, y que dos upserts consecutivos al mismo `(vehicle_id, type)` actualizan la misma fila
  (`COUNT=1`) en vez de duplicarla.
- `npm run test:ci`: 1982 tests verdes (0 regresiones). `npx tsc --noEmit`: sin errores.
  `npm run lint:arch`: sin errores nuevos (exit 0).
- **Pendiente de deploy:** igual que fix-152-m, la migración está creada pero no pusheada a remoto
  (`npx supabase db push`) — decisión del usuario de dejarlo pendiente junto con el resto de
  migraciones ya acumuladas desde `20260808120000`.
