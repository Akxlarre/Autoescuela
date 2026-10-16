# fix-224-b — Un vehículo en Mantenimiento o Fuera de servicio sigue ofreciéndose

- **Autor:** b
- **Origen:** ASG-i-032 (testing Flota), sospechas S5 y S12 + decisión 1 del owner (2026-10-12).
- **Estado:** cerrado (2026-10-15)

## Bug

Cambiar el estado de un vehículo a Mantenimiento o Fuera de servicio no tiene efecto fuera de Flota:

1. `v_class_b_schedule_availability` no mira `vehicles.status`: el instructor con ese vehículo
   asignado sigue ofreciendo horarios en la matrícula, la Agenda, la ficha del alumno y el pago
   online (todos leen la vista).
2. El selector de vehículo de "Iniciar clase" (`AsistenciaClaseBFacade.loadVehiclesByBranch`)
   lista todos los vehículos de la sede, incluidos los que están en mantenimiento, y además
   **omite los vehículos "Ambas"** de otra sede, que sí pueden usarse en esa clase (S12).
3. El picker "Vehículo asignado" de Crear/Editar instructor solo reconoce `maintenance` y
   `blocked`: un vehículo `out_of_service` o `mantenimiento` aparece como disponible.

## Criterios (ACs afectados)

- **V1** — Un vehículo no operativo (estado `maintenance`, `mantenimiento`, `out_of_service`,
  `blocked`; mismo mapa que `resolveVehicleStatus`) no genera turnos en
  `v_class_b_schedule_availability`. Al volver a Disponible, los turnos reaparecen.
- **V2** — El selector de "Iniciar clase" lista los vehículos operativos de la sede de la clase
  **y** los "Ambas", y ningún vehículo no operativo.
- **V3** — Si el vehículo de la clase no está operativo, el drawer no lo preselecciona y pide
  elegir otro antes de iniciar.
- **V4** — El picker de vehículo de Crear/Editar instructor marca como no disponible a todo
  vehículo no operativo (los 4 estados).
- **V5** — Clases ya agendadas con ese vehículo no se tocan (fuera de alcance: se reasignan a mano).

## Cambio

- `core/utils/vehicle-status.utils.ts`: `isVehicleOperational(raw)`.
- Migración `20261015120000_fix224_vehiculo_no_operativo_sin_turnos.sql`:
  `vehicle_is_operational(text)` (IMMUTABLE, espejo del util) + vista con
  `AND public.vehicle_is_operational(v.status)` en el join de vehículos.
- `asistencia-clase-b.facade.ts` `loadVehiclesByBranch`: sede o "Ambas", solo operativos.
- `admin-iniciar-clase-drawer.component.ts`: preselección solo si el vehículo está en la lista;
  si no, pide elegir.
- `instructores.facade.ts` `loadVehicles`: estado vía `resolveVehicleStatus`.

## Verificación

- [x] vitest: util + facades.
- [x] Test SQL `supabase/tests/flota/fix-224-b-vehiculo-no-operativo.sql` en BEGIN…ROLLBACK.
- [x] Migración aplicada en producción (requiere aprobación del owner) + test en verde.
