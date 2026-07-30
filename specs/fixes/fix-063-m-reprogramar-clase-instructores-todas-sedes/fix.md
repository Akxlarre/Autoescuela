# Fix: Reprogramar clase (ficha técnica) muestra instructores de todas las sedes, no solo de la sede del alumno
> id: fix-063-m-reprogramar-clase-instructores-todas-sedes
> refs: —
> status: done
> closed: 2026-07-25
> created: 2026-07-25

## Root Cause
`AdminAlumnoDetalleFacade.loadInstructores()` (`admin-alumno-detalle.facade.ts:1098-1119`) consulta la tabla `instructors` sin ningún filtro de sede (`.eq('active', true).is('vehicle_assignments.end_date', null)`, sin `.eq('users.branch_id', ...)`). Este método alimenta el selector de instructor en dos drawers de `admin-alumno-detalle`: "Reprogramar Clase" (ficha técnica) y "Reagendar Clases" (paso 2, reasignación de clases canceladas). El resultado es que aparecen instructores de **todas** las sedes, incluso cuando quien reprograma es una secretaria acotada a una sola sede — no tiene sentido de negocio (ni de RBAC) que se pueda asignar un instructor de otra sede a una clase de un alumno matriculado en una sede distinta. El facade nunca leyó `branch_id` del alumno/matrícula: `AlumnoDetalleUI` no tiene ese campo y `fetchDetalleData()` no lo selecciona de `enrollments`.

## ACs Afectados
- Ninguno — fix autónomo (bug de scope/RBAC reportado por el dueño).

## Cambio
- `core/models/ui/alumno-detalle.model.ts` — agregar `branchId: number | null` a `AlumnoDetalleUI`.
- `admin-alumno-detalle.facade.ts` (`fetchDetalleData`) — seleccionar `branch_id` en el join de `enrollments` y setear `branchId: lastEnrollment?.branch_id ?? null` al construir `_alumno`.
- `admin-alumno-detalle.facade.ts` (`loadInstructores`) — filtrar por `.eq('users.branch_id', branchId)` leyendo `this._alumno()?.branchId`, mismo patrón usado en `instructores.facade.ts:263`/`agenda.facade.ts:429`/`admin-alumnos.facade.ts:365`. Sin `branchId` (alumno no cargado aún), no aplica filtro — no debería ocurrir en uso normal ya que `loadInstructores()` se llama tras cargar la ficha.

## Test de Regresión
- `admin-alumno-detalle.facade.spec.ts` (`describe('loadInstructores — scope de sede (fix-063)')`):
  - "filtra por users.branch_id igual al branchId del alumno cargado" ✓
  - "no aplica filtro de sede si el alumno aún no tiene branchId" ✓ (sin regresión cuando no hay dato)

31/31 tests verdes en `admin-alumno-detalle.facade.spec.ts`. `tsc --noEmit` sin errores.

## Nota de alcance
Se extendió mínimamente el `Cambio` declarado: `EnrollmentSummary` también ganó `branchId` y `selectEnrollment()` lo propaga al cambiar de matrícula activa — sin esto, un alumno con matrículas en dos sedes distintas seguiría filtrando instructores por la sede de la matrícula inicialmente cargada tras cambiar de pestaña. Mismo root cause (branch_id nunca se leía), no una causa nueva.
