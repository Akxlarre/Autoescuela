# Fix: La agenda del vehículo pisa clases, no muestra las de la tarde y muestra las canceladas
> id: fix-221-b-agenda-vehiculo
> refs: ASG-i-032 (checklist 032, sospecha S13; casos K01–K06)
> status: done
> created: 2026-10-13

## Root Cause
[Confirmado leyendo `flota.facade.ts` el 2026-10-12.] `loadVehicleAgenda()` arma la agenda sobre una
grilla fija de horas en punto de 08 a 17:

- Indexa las clases con un `Map` por hora: la clase de las 11:50 pisa a la de las 11:00 (y la de
  15:50 a la de 15:00). Solo se ve una.
- El bucle va de 8 a 17: las clases de 18:00, 18:20, 19:10 y 21:30 (existen en la BD) no aparecen.
- No filtra por estado: una clase cancelada se muestra como clase.
- Consulta los mantenimientos del día y nunca los agrega.
- Toda clase se muestra como "HH:00", aunque empiece a las HH:50.

## ACs Afectados
Ninguno de una spec previa. ACs propios:
- **F1:** todas las clases del día del vehículo aparecen, en orden, con su hora real de inicio y de
  término (según `duration_min`), sea cual sea la hora.
- **F2:** dos clases en la misma hora "en punto" (11:00 y 11:50) aparecen las dos.
- **F3:** las clases canceladas no aparecen.
- **F4:** los mantenimientos programados para ese día aparecen, antes de las clases.
- **F5:** sin clases ni mantenimientos, se dice "Sin actividad hoy" (antes "Sin datos").

Fuera de alcance: ver otros días (K07, decisión pendiente).

## Cambio
- `src/app/core/utils/vehicle-agenda.utils.ts` (+ spec) — `buildVehicleAgenda()`, función pura.
- `src/app/core/facades/flota.facade.ts` (+ spec) — la usa; pide `duration_min`.
- `src/app/features/admin/flota/vehicle-agenda-drawer/vehicle-agenda-drawer.component.ts` — texto del
  estado vacío y `track` por posición (dos filas pueden compartir hora).

## Test de Regresión
- `npx vitest run src/app/core/utils/vehicle-agenda.utils.spec.ts src/app/core/facades/flota.facade.spec.ts`
- `npx playwright test e2e/flota-agenda.spec.ts --workers=1`

## Progreso
- [x] `vehicle-agenda.utils.spec.ts` 8/8 y `flota.facade.spec.ts` 22/22 (el test existente de la hora de Chile sigue pasando).
- [x] `e2e/flota-agenda.spec.ts` 2/2 (datos en la respuesta, la BD no se toca): 11:00 y 11:50 aparecen las dos, las de 18:20 y 21:30 también, la cancelada no, el mantenimiento primero, "hasta las 12:40", y "Sin actividad hoy" cuando no hay nada. `tsc` sin errores, `lint:arch` 0 errores.
