# Fix: sin indicio visual cuando una clase "Agendada" ya pasó su hora de inicio
> id: fix-178-m-indicador-clase-atrasada-dashboard-instructor
> refs: —
> status: done
> closed: 2026-08-14
> created: 2026-08-14

## Root Cause
En "Mis Clases de Hoy" (`InstructorDashboardComponent`), una fila con `status === 'scheduled'`
(tag "Agendada") se ve exactamente igual sin importar si su hora de inicio (`cls.scheduledAt`)
ya pasó o todavía no llega. El instructor no tiene forma de distinguir de un vistazo "esta
clase está atrasada, el alumno no ha llegado o no la he iniciado" de "esta clase es más tarde".
Es una omisión de diseño, no un bug de datos — `scheduledAt` ya viene como timestamp completo
(con offset), así que no hay problema de timezone al compararlo con la hora actual (a
diferencia de fix-176, que comparaba solo fechas).

## ACs Afectados
- Ninguno — fix autónomo (mejora de claridad visual, sin AC previo).

## Cambio
- **Archivo:** `src/app/core/utils/class-schedule-timing.utils.ts` (nuevo)
  **Qué cambia:** función pura `isClassStartOverdue(scheduledAt: string, status: string, now?: Date): boolean`
  — true cuando `status === 'scheduled'` y `scheduledAt` ya pasó respecto a `now`.
- **Archivo:** `src/app/features/instructor/dashboard/instructor-dashboard.component.ts`
  **Qué cambia:** agrega un indicador visual (texto + ícono en color de advertencia, patrón
  similar al de `in_progress` agregado en fix-176) cuando `isClassStartOverdue(...)` es true
  para la fila.

## Test de Regresión
- `src/app/core/utils/class-schedule-timing.utils.spec.ts > isClassStartOverdue detecta clases agendadas cuya hora de inicio ya pasó` ✓
