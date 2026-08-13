# Fix: Advertencia de documentos de vehículo vencidos/por vencer en el agendamiento
> id: fix-164-m-advertencia-documentos-vehiculo-agendamiento
> refs: docs/UAT-PLAN.md — Paquete 3 (Agenda y Triple Match), ítem "Intentar agendar con un vehículo cuyo SOAP/revisión técnica está vencido"
> status: done
> closed: 2026-08-12
> created: 2026-08-12

## Root Cause
El UAT-PLAN marcaba este ítem como cerrado por fix-153/fix-154, pero esos tracks corrigieron
la UI de carga de documentos del vehículo (un bug distinto, sin relación con el agendamiento).
`AgendaFacade` nunca validó ni expuso `vehicle_documents.expiry_date` en el flujo de
agendamiento — solo existe la alerta del dashboard (`DashboardAlertsFacade`) y el cron
`notify_vehicle_document_expiry`, que son historial/recordatorio, no una advertencia en el
momento de agendar. La funcionalidad nunca se implementó.

## ACs Afectados
- Ninguno — fix autónomo (feature nunca implementada, no una regresión de AC existente).
  Cierra el ítem pendiente del UAT-PLAN Paquete 3.

## Cambio
- **Archivo:** `src/app/core/utils/vehicle-document-status.utils.ts` (nuevo)
  **Qué cambia:** extrae `resolveDocStatus()` desde `FlotaFacade` como función pura
  reutilizable (`expired | expiring_soon | valid`, umbral 30 días).
- **Archivo:** `src/app/core/facades/flota.facade.ts`
  **Qué cambia:** usa la función extraída en vez de su copia privada (sin duplicar lógica).
- **Archivo:** `src/app/core/facades/agenda.facade.ts`
  **Qué cambia:** al traer los slots, hace join a `vehicle_documents` por `vehicle_id` y
  expone `vehicleDocWarning: 'expired' | 'expiring_soon' | null` por slot.
- **Archivo:** `src/app/shared/components/agenda-semanal/agenda-semanal.component.ts`
  **Qué cambia:** agrega input `showVehicleWarnings` (default `true`); si el slot trae
  `vehicleDocWarning` y el input está en `true`, muestra un badge/ícono de advertencia
  (Lucide `triangle-alert`, tokens del DS) con tooltip. No bloquea la selección ni la
  confirmación del slot.
- **Flujo público de matrícula:** sin cambios. `public-enrollment-steps/public-schedule` usa
  `ScheduleGridComponent` (`shared/components/schedule-grid/`), un componente y modelo de datos
  (`EnrollmentAssignmentData`) completamente separados de `AgendaFacade`/`AgendaSlot` — nunca
  expone información de vehículos al alumno, así que no hay nada que ocultar con
  `showVehicleWarnings`. El input igual queda con default `true` en `AgendaSemanalComponent` por
  si algún flujo interno nuevo lo reutiliza sin querer mostrar el badge.

## Test de Regresión
- `src/app/core/utils/vehicle-document-status.utils.spec.ts > resolveDocStatus clasifica expired/expiring_soon/valid según expiry_date` ✓
- `src/app/core/utils/vehicle-document-status.utils.spec.ts > shouldShowVehicleDocWarning respeta showVehicleWarnings` ✓
- `src/app/core/utils/vehicle-document-status.utils.spec.ts > vehicleDocWarningLabel arma el texto según el estado` ✓
- `src/app/core/facades/agenda.facade.spec.ts > expone vehicleDocWarning por slot según vehicle_documents` ✓
- `src/app/shared/components/agenda-semanal/agenda-slot.component.spec.ts` queda en `describe.skip` — sigue el mismo TODO
  preexistente en `icon.component.spec.ts`/`kpi-card.component.spec.ts` (TestBed no compila templates en Vitest en este
  proyecto). La decisión (`showVehicleDocWarning`/`vehicleDocWarningLabel`) que antes vivía en el componente se extrajo a
  `vehicle-document-status.utils.ts` para quedar cubierta por tests reales pese a esa limitación de infra.
