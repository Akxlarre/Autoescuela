# Fix: Advertencia de documentos de vehículo — corrección de alcance (flujos reales de agendamiento)
> id: fix-165-m-advertencia-vehiculo-scheduling-real-flows
> refs: specs/fixes/fix-164-m-advertencia-documentos-vehiculo-agendamiento (corrige su alcance)
> status: done
> closed: 2026-08-12
> created: 2026-08-12

## Root Cause
`fix-164-m` implementó el badge de advertencia de documentos de vehículo en `AgendaFacade` +
`AgendaSlotComponent` (la Agenda Semanal, vista de solo lectura). Se asumió sin verificar que
los 3 flujos reales de agendamiento (nueva matrícula, reagendamiento masivo, reprogramación
individual) reutilizaban ese mismo componente — la única evidencia usada fue una nota de
fix-152, que en realidad protegía los 4 flujos a nivel de constraint de BD, no de UI compartida.

En los hechos, esos 3 flujos usan un pipeline completamente distinto:
- **Nueva matrícula** → `EnrollmentFacade.buildScheduleGrid()` → `AssignmentComponent` →
  `ScheduleGridComponent` (shared). La query a `v_class_b_schedule_availability` ya trae
  `vehicle_id`, pero `buildScheduleGrid()` lo descarta al armar `TimeSlot`.
- **Reagendamiento masivo** → `AdminAlumnoDetalleFacade.buildScheduleGrid()` → mismo
  `AssignmentComponent`/`ScheduleGridComponent`. Este facade ya tenía `_slotVehicleMap`
  (`slot_start → vehicle_id`) para otro propósito (persistir el vehículo al reprogramar).
- **Reprogramación individual** → mismo `AdminAlumnoDetalleFacade`, pero el drawer renderiza
  su **propio** grid inline (no reutiliza `ScheduleGridComponent`).

El flujo público (`PublicEnrollmentFacade.loadScheduleGrid()`) obtiene su grid desde una Edge
Function (`public-enrollment`, acción `load-schedule`) — un pipeline server-side aparte, así
que la exclusión decidida en fix-164 para el público sigue siendo correcta.

Consecuencia: se pudo agendar una clase con un vehículo de SOAP vencido en los 3 flujos reales
sin ver ninguna advertencia — verificado por el usuario en la app.

## ACs Afectados
- Ninguno — corrige el alcance de fix-164-m (feature no llegó a los flujos que importaban).

## Cambio
- **Archivo:** `src/app/core/models/ui/enrollment-assignment.model.ts`
  **Qué cambia:** agrega `vehicleDocWarning?: 'expired' | 'expiring_soon' | null` a `TimeSlot`
  (opcional — el flujo público, cuyo `TimeSlot` viene de la Edge Function, simplemente no lo trae).
- **Archivo:** `src/app/core/utils/vehicle-document-status.utils.ts`
  **Qué cambia:** agrega `buildVehicleDocWarningMap()` (reduce filas de `vehicle_documents` a
  `Map<vehicle_id, warning>`, reutilizable) y `vehicleDocWarningLabelGeneric()` (label sin
  patente, para grillas que no muestran vehículo por slot).
- **Archivo:** `src/app/core/facades/agenda.facade.ts`
  **Qué cambia:** refactor — usa `buildVehicleDocWarningMap()` en vez de su loop inline
  duplicado (sin cambio de comportamiento).
- **Archivo:** `src/app/core/facades/enrollment.facade.ts`
  **Qué cambia:** `loadScheduleGrid()`/`buildScheduleGrid()` traen `vehicle_documents` y
  populan `vehicleDocWarning` por slot.
- **Archivo:** `src/app/core/facades/admin-alumno-detalle.facade.ts`
  **Qué cambia:** `loadScheduleGrid()`/`buildScheduleGrid()` ídem, reutilizando el patrón de
  `_slotVehicleMap` ya existente.
- **Archivo:** `src/app/shared/components/schedule-grid/schedule-grid.component.ts`
  **Qué cambia:** agrega input `showVehicleWarnings` (default `true`) y el badge
  (`triangle-alert` + tooltip) por slot cuando `vehicleDocWarning` no es `null`.
- **Archivo:** `src/app/features/admin/alumno-detalle/reprogramar-clase-drawer/admin-reprogramar-clase-drawer.component.ts`
  **Qué cambia:** agrega el mismo badge a su grid inline propio.
- **Archivo:** `src/app/shared/components/public-enrollment-steps/public-schedule/public-schedule.component.ts`
  **Qué cambia:** pasa `[showVehicleWarnings]="false"` a `<app-schedule-grid>` como defensa en
  profundidad (aunque su `TimeSlot` ya no trae el campo por venir de la Edge Function).

## Test de Regresión
- `src/app/core/utils/vehicle-document-status.utils.spec.ts > buildVehicleDocWarningMap prioriza expired sobre expiring_soon por vehículo` ✓
- `src/app/core/facades/enrollment.facade.spec.ts > buildScheduleGrid puebla vehicleDocWarning por slot` ✓
- `src/app/core/facades/admin-alumno-detalle.facade.spec.ts > buildScheduleGrid puebla vehicleDocWarning por slot` ✓
