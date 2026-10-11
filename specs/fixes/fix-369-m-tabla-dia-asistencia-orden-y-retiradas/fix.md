# Fix: tabla del día de Asistencia B — orden por hora real y clases de matrículas no activas
> id: fix-369-m-tabla-dia-asistencia-orden-y-retiradas
> refs: fix-366-m-testing-asistencia-clase-b (B03, B05) · ASG-i-027 · 0030-b
> status: done
> closed: 2026-10-11
> created: 2026-10-11

## Síntoma

Bloque 2 de `fix-366-m`:
- **B05:** admin con "Todas las sedes" ve la clase de una matrícula retirada como
  "Sin sede · Sin agendar", sin acciones.
- **B03:** la clase de las 11:30 (sede B) y la de las 13:30 quedan al final de la tabla, después
  de las de 18:00 y 21:30.

## Root Cause

`AsistenciaClaseBFacade.fetchPracticas()`:
- El embed `enrollments(...)` no es `!inner`, así que `.eq('enrollments.status', 'active')` no
  descarta la sesión: la deja con `enrollments: null`. Con una sede elegida el filtro del cliente
  (`!row.enrollments`) la saca; con "Todas" (`branchId === null`) pasa.
- Ordena por `start_time` (hora real de inicio, nula hasta que alguien inicia), no por
  `scheduled_at` (hora agendada).

## Fix

`enrollments!inner(...)` y `.order('scheduled_at')`. El filtro del cliente queda sobrando y se
quita.

## Acceptance Criteria

- [x] AC1 — Con "Todas las sedes", una clase de una matrícula no activa no aparece.
- [x] AC2 — La tabla se ordena por hora agendada.

## Regression Test

`asistencia-clase-b.facade.spec.ts` → la query usa `enrollments!inner(` y ordena por
`scheduled_at`. Verificación en navegador con los datos del bloque 2.

## Verificación (2026-10-11)

Admin "Todas las sedes", datos del bloque 2: la clase de la matrícula retirada (13:00) ya no aparece
y el orden es 11:00, 11:30 (sede B), 12:00, 13:30, 18:00, 21:30. Facade 41/41.
