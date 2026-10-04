# Fix: El historial de reagendamientos sigue a la matrícula elegida
> id: fix-298-m-historial-de-reagendamientos-sigue-a-la-matricula-elegida
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
El historial de reagendamientos de la ficha se carga una sola vez, en `ngOnInit` del componente,
para la matrícula con la que se abrió la ficha. `AdminAlumnoDetalleFacade.selectEnrollment()`
recarga el progreso, los pagos y las clases de la matrícula elegida, pero no el historial: con dos
matrículas, el panel "Reagendamientos" sigue mostrando el de la primera aunque el resto de la
ficha ya sea de la otra. Además, `initialize()` no lo vacía al cambiar de alumno. Es la mitad de
`024b` S14 que `fix-265-m` no cubrió; encontrado en la 3ª pasada de `fix-264-m` (`024b` N07). Es B41.

## ACs Afectados
- `024b` N07: con dos matrículas, "Reagendamientos" muestra el historial de la matrícula elegida.
- `024b` N08: la ficha de un alumno sin reagendamientos nunca muestra los del alumno anterior.

## Cambio
- **Archivo:** `src/app/core/facades/admin-alumno-detalle.facade.ts`
- **Qué cambia:** `selectEnrollment()` vacía el historial y carga el de la matrícula elegida
  (Clase B); `initialize()` lo vacía al cambiar de alumno; `loadHistorialReagendamientos()` descarta
  una respuesta que llega cuando ya se eligió otra matrícula.

## Test de Regresión
- `admin-alumno-detalle.facade.spec.ts > estado desde la matrícula — fix-263-m > selectEnrollment carga el historial de reagendamientos de la matrícula elegida (fix-298-m)` ✓
- `admin-alumno-detalle.facade.spec.ts > estado desde la matrícula — fix-263-m > descarta el historial de una matrícula que ya no es la elegida (fix-298-m)` ✓
- `e2e/alumnos-b-ficha.spec.ts > tercera pasada > N06 · N07 · C07 (S14)` ✓ (falló antes del arreglo: el panel seguía vacío al elegir la matrícula antigua)
