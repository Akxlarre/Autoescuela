# Fix: Bloquear cambio de sede en editar vehículo cuando tiene instructor activo asignado
> id: fix-119-m-bloquear-cambio-sede-vehiculo-con-instructor
> refs: —
> status: done
> closed: 2026-08-05
> created: 2026-08-05

## Root Cause
`VehicleFormDrawerComponent` permite editar `branch_id`/`both_branches` de un vehículo vía
`app-branch-scope-selector` sin validar si existe una asignación activa en
`vehicle_assignments` (`end_date IS NULL`). `FlotaFacade.updateVehicle()` hace un `update`
directo sin chequeo alguno, y no hay constraint/trigger en BD que lo impida. El vehículo ya
trae `instructorId`/`instructorName` calculados desde la asignación activa
(`FlotaFacade.mapToTableRow`), pero el drawer nunca los consulta antes de habilitar el
selector de sede. Resultado: se puede mover un vehículo de sede mientras sigue asignado a un
instructor de la sede anterior, dejando el dato inconsistente.

## ACs Afectados
Ninguno — fix autónomo (gap descubierto en QA manual, sin spec previa que lo declarara).

- AC-1: Si el vehículo en edición tiene `instructorId` activo, `app-branch-scope-selector`
  se muestra deshabilitado (no clickeable) y con un mensaje explicando que debe desasignarse
  el instructor primero desde "Editar Instructor".
- AC-2: Si el vehículo no tiene instructor activo (`instructorId === null`), o es creación
  nueva, el selector de sede funciona igual que antes (sin restricción).

## Cambio
- **Archivo:** `src/app/features/admin/flota/vehicle-form-drawer/vehicle-form-drawer.component.ts`
- **Qué cambia:** el componente lee `instructorId`/`instructorName` del vehículo seleccionado
  en `flotaFacade.vehicles()`, calcula un `computed()` `hasActiveInstructor` y lo pasa a
  `app-branch-scope-selector` para deshabilitarlo, mostrando un mensaje inline con el nombre
  del instructor y la ruta para desasignarlo.

## Test de Regresión
- `vehicle-form-drawer.component.spec.ts > deshabilita el selector de sede cuando el vehículo tiene instructor activo asignado` ✓
