# Hotfix: La columna "Fecha ingreso" de la lista de alumnos se ve como aaaa-mm-dd
> id: hotfix-123-m-lista-alumnos-fecha-ingreso-dd-mm-aaaa
> refs: fix-264-m (sospecha S9 de `024a`), fix-273-m, ASG-i-054
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Problema
`AdminAlumnosFacade` arma la fecha de ingreso de cada fila con `created_at.slice(0, 10)`: el dato crudo de la base, recortado. Se ve `2026-09-22`. Desde `fix-273-m` la ficha muestra esa misma fecha como `22-09-2026`, así que lista y ficha quedaron con formatos distintos. Además, al recortar el ISO el día sale en UTC: una matrícula hecha de noche en Chile aparece con el día siguiente.

**Decisión del owner (Matías, 2026-10-01):** la lista usa `dd-mm-aaaa`, igual que la ficha.

## Cambios
- **Archivo:** `src/app/core/facades/admin-alumnos.facade.ts` — `fechaIngreso` usa `formatDayMonthYear()` (la misma función de la ficha: `dd-mm-aaaa`, día en hora local).

La exportación a Excel/PDF no cambia: la genera la función `export-students` (bug B1 de `fix-264-m`, pendiente de coordinar con `0009-i`). El resto de las fechas en UTC sigue en `ASG-i-054`.

## Verificación
Verificado el 2026-10-01: `admin-alumnos.facade.spec.ts > fecha de ingreso — hotfix-123-m` (2 tests) en verde, `tsc` de la app sin errores y `e2e/alumnos-b-lista.spec.ts` con 24/24 esperados. En navegador la columna muestra `22-09-2026`, tanto en la tabla como en la tarjeta a 375 px.
