# Fix: No existe UI para asignar/cargar documentos (SOAP, Revisión Técnica, etc.) a un vehículo
> id: fix-153-m-vehiculo-documentos-sin-ui-de-carga
> refs: docs/UAT-PLAN.md — Paquete 3 (bloqueo por SOAP vencido al agendar) y Paquete 5 (alertas de vencimiento)
> status: in_progress
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
- **Archivo:** `src/app/features/admin/flota/vehicle-documents-drawer/vehicle-documents-drawer.component.ts`
- **Qué cambia:** agregar un formulario (tipo de documento, fecha de vencimiento, adjunto opcional)
  que invoque `FlotaFacade.upsertVehicleDocument()`, siguiendo el patrón `DrawerFormComponent` ya
  usado en el resto de drawers del proyecto (ver `indices/COMPONENTS.md`).

## Test de Regresión
- Pendiente: test del Facade (`flota.facade.spec.ts`) que confirme que `upsertVehicleDocument()` se
  invoca con el payload correcto al enviar el formulario nuevo.
