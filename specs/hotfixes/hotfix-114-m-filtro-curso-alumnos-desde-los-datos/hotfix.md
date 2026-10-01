# Hotfix: El filtro Curso de la lista de Alumnos no ofrece "Refuerzo Clase B"
> id: hotfix-114-m-filtro-curso-alumnos-desde-los-datos
> refs: fix-264-m (bug B3)
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Problema
Las opciones del filtro Curso están escritas a mano ("Clase B" y "Clase B SENCE"). Existe el curso "Refuerzo Clase B" en ambas sedes y sus alumnos no se pueden filtrar; lo mismo pasaría con cualquier curso B nuevo.

## Cambios
- **Archivo:** `src/app/core/utils/course-filter-options.utils.ts` (nuevo) — `buildCourseFilterOptions()`: opciones únicas y ordenadas a partir de los cursos de las filas cargadas.
- **Archivo:** `src/app/core/utils/course-filter-options.utils.spec.ts` (nuevo) — tests de la función.
- **Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` — `cursos` pasa de lista fija a `computed()` sobre `alumnos()`.
- **Archivo:** `indices/UTILS.md` — registra el util.
- **Archivo:** `e2e/alumnos-b-lista.spec.ts` — el test F03 siembra un alumno de refuerzo y deja de estar marcado `knownBug`.

## Verificación
Verificado el 2026-10-01: el test E2E del caso pasa en navegador sin la marca `knownBug`, `npx vitest run` (2835 tests) y `npm run lint:arch` (0 errores) en verde.
