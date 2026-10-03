# Fix: Buscar o filtrar vuelve a la primera página en las cuatro listas de alumnos
> id: fix-283-m-buscar-o-filtrar-vuelve-a-la-primera-pagina
> refs: ASG-i-024
> status: done
> closed: 2026-10-03
> created: 2026-10-03

## Root Cause
Para el orden por columna (`0020-m`) la tabla de la Base de Alumnos B pasó a recibir la página por
`[first]="tableFirst()"`: desde ese momento PrimeNG ya no vuelve sola a la página 1 cuando cambian
las filas, y solo el orden y "Limpiar filtros" reiniciaban `tableFirst`. `0023-m` copió el mismo
esquema en Ex-Alumnos B y en las dos listas profesionales. Resultado: buscar o filtrar estando en
la página 3 deja "Mostrando 21 a 10 de 10" y la tabla vacía. En Ex-Alumnos B, además, buscar no
devuelve las tarjetas a 6. Es B25 de la 2ª pasada de `fix-264-m` (`024a` E11, F07; `024b` V04).

## ACs Afectados
- `024a` E11 y F07: buscar o filtrar desde cualquier página muestra la página 1 del resultado.
- `024b` V04: buscar después de "Cargar más" vuelve a 6 tarjetas (como la Base B).
- Sin cambio para `fix-282-m`: volver desde la ficha restaura la página guardada.

## Cambio
Cambiar un filtro (búsqueda, selectores, período) reinicia la paginación de tabla y tarjetas:
- **Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` —
  `updateFilter()` vuelve a la página 1.
- **Archivo:** `src/app/shared/components/ex-alumnos-content/ex-alumnos-content.component.ts`,
  `ex-alumnos-profesional-content/…`, `alumnos-profesional-list-content/…` — `resetPagination()`
  al cambiar búsqueda, selectores o período.

## Test de Regresión
- `alumnos-list-content.component.spec.ts > buscar o filtrar vuelve a la primera página (fix-283-m)` ✓
- `ex-alumnos-content.component.spec.ts > buscar o cambiar el período vuelve a la página 1 y a 6 tarjetas` ✓
- `e2e/alumnos-b-lista.spec.ts > E11 · F07 (B25)` sin la marca `knownBug` ✓
