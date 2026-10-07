# Fix: Listas de instructores y secretarias esconden el error y aceptan respuestas fuera de orden
> id: fix-209-b-listas-personal-error-y-orden
> refs: ASG-i-034 (sospecha S19, confirmada en fix-197-b)
> status: done
> created: 2026-10-07

## Root Cause
[Confirmado leyendo el código el 2026-10-07.] `InstructoresFacade` y `SecretariasFacade`:
1. Si la carga falla guardan `error`, pero la tabla muestra "No hay instructores que coincidan con
   los filtros." / "No hay registros que coincidan con los filtros." — parece una lista vacía.
   Además `error` nunca se limpia tras una carga exitosa, e `initialize()` relanza el error sin
   capturarlo (promesa rechazada sin manejar en el componente).
2. `fetchData()` no usa `createRequestGuard()` (regla de `facades.md` para facades branch-scoped
   SWR): cambiar de sede rápido puede terminar mostrando la lista de la sede anterior.

## ACs Afectados
Ninguno de una spec previa. ACs propios:
- **F1:** sin datos y con error, ambas tablas muestran el error ("No se pudo cargar la lista…"), no "No hay…".
- **F2:** una carga exitosa limpia el error; `initialize()` no deja promesas rechazadas sin manejar.
- **F3:** una respuesta vieja no pisa la de la sede vigente (guard por `fetchData()`).

## Cambio
- `src/app/core/facades/instructores.facade.ts`, `src/app/core/facades/secretarias.facade.ts` (+ specs).
- `src/app/features/admin/instructores/admin-instructores.component.ts`,
  `src/app/features/admin/secretarias/admin-secretarias.component.ts` — estado de error.

## Test de Regresión
- `npx vitest run src/app/core/facades/instructores.facade.spec.ts src/app/core/facades/secretarias.facade.spec.ts`
- `npx playwright test e2e/personal-listas-error.spec.ts --workers=1` (build de prod en :4200)

## Progreso
- [x] +3 tests por facade (error sin rechazo, error limpiado, respuesta vieja descartada), rojo → verde; 42/42. El merge de "Ambas sedes" pasó a `mergeBothBranchesInstructors()` para no alargar `fetchData()`.
- [x] `ng build` ✓, `lint:arch` 0 errores (182, sin nuevas). e2e con la consulta de la lista fallando (500 simulado): ambas páginas muestran el error y no "No hay…". Con `instructores-alta.spec.ts`, 8/8 en serie. En paralelo, dos workers con la misma cuenta admin cerraron la sesión: problema de la suite, no del fix.
