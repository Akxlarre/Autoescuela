# Fix: "Clases activas" del instructor se calcula con el día en UTC y su botón no hace nada
> id: fix-207-b-ficha-instructor-clases-activas
> refs: ASG-i-034 (sospecha S15, confirmada en fix-197-b)
> status: done
> created: 2026-10-07

## Root Cause
[Confirmado leyendo el código el 2026-10-07.]
1. `fetchActiveClassesCounts()` (fix-072-m) acota las clases `in_progress` a "hoy" con
   `${hoy}T00:00:00` / `${hoy}T23:59:59` **sin zona horaria**: Postgres los lee en UTC. En Chile
   (UTC-3/-4) una clase en curso desde las 20:00–21:00 cae en el "mañana" UTC y no se cuenta; de
   madrugada UTC se cuentan las de ayer. Mismo bug que ya resolvió `getChileDateTimeRange()` para pagos.
2. En la ficha (Ver instructor), el botón "Ver clases activas (N)" no tiene `(click)`: no hace nada.

Se mantiene la decisión de fix-072-m: solo las de **hoy** (no las `in_progress` colgadas de días
anteriores).

## ACs Afectados
- **F1:** el rango de "hoy" usa `getChileDateTimeRange()` (offset de Santiago).
- **F2:** sin botón muerto: se quita "Ver clases activas (N)"; el número sigue en el KPI "Clases activas".
- **F3:** el test de fix-072 (no contar huérfanas de días anteriores) sigue valiendo, con el rango nuevo.

## Cambio
- `src/app/core/facades/instructores.facade.ts` (+ spec) — rango con `getChileDateTimeRange()`.
- `src/app/features/admin/instructores/admin-instructor-ver-drawer.component.ts` — quitar el botón.

## Test de Regresión
- `npx vitest run src/app/core/facades/instructores.facade.spec.ts`

## Progreso
- [x] Test de fix-072 actualizado al rango con offset (rojo → verde); `instructores.facade.spec.ts` 27/27.
- [x] Botón muerto quitado de la ficha. `ng build` ✓, `lint:arch` 0 errores (182, sin nuevas); `e2e/instructores-alta.spec.ts` 2/2 (la página de instructores carga con la query nueva). El mismo formato de rango ya se usa contra PostgREST en pagos (`getChileDateTimeRange`).
