# Fix: Horas trabajadas sin filtro de sede, con el error escondido y el mes pegado
> id: fix-208-b-horas-instructores-sede-error
> refs: ASG-i-034 (sospecha S16, confirmada en fix-197-b)
> status: done
> created: 2026-10-07

## Root Cause
[Confirmado leyendo el código el 2026-10-07.] `InstructoresFacade.loadHorasMensuales()`:
1. Consulta `instructor_monthly_hours` solo por `period`, sin sede: lo que se ve depende de la RLS.
   Instructores que no están en la lista cargada (otra sede) salen como "Instructor #id".
2. Un error de la query deja la lista vacía y el drawer dice "Sin clases registradas para este período."
3. El mes elegido vive en el facade (singleton): al reabrir el drawer sigue en el mes de la vez anterior.
4. Sin guard de orden: navegar meses rápido puede dejar a la vista la respuesta de otro mes.

## ACs Afectados
Ninguno de una spec previa. ACs propios:
- **F1:** la query se acota a los instructores de la lista (ya filtrada por sede); sin instructores, no consulta.
- **F2:** un error se muestra como error ("No se pudieron cargar las horas…"), no como "Sin clases".
- **F3:** abrir el drawer parte en el mes actual.
- **F4:** una respuesta vieja no pisa la del mes vigente (`createRequestGuard`).

## Cambio
- `src/app/core/facades/instructores.facade.ts` (+ spec) — `.in('instructor_id', …)`, signal
  `horasError`, `abrirHorasMensuales()` (mes actual + carga), guard.
- `src/app/features/admin/instructores/admin-instructor-horas-drawer.component.ts` — usa
  `abrirHorasMensuales()` y muestra el error.

## Test de Regresión
- `npx vitest run src/app/core/facades/instructores.facade.spec.ts`
- `npx playwright test e2e/instructores-horas.spec.ts` (build de prod en :4200)

## Progreso
- [x] `instructores.facade.spec.ts` +5 (F1 ×2, F2, F3, F4), rojo → verde; 32/32. Mapeo extraído a `mapHorasRows()` (sin advertencias nuevas).
- [x] `ng build` ✓, `lint:arch` 0 errores (182). e2e 2/2: la secretaria de sede 1 consulta con `instructor_id=in.(…)`; con la consulta fallando (500 simulado) se ve el error y no "Sin clases".
