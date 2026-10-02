# Fix: Los filtros de la Base de Alumnos se pierden al salir de la pantalla y volver
> id: fix-275-m-lista-alumnos-conserva-filtros
> refs: fix-264-m (caso F10 de `024a`), ASG-i-024
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Root Cause

La búsqueda y los tres filtros de la Base de Alumnos (curso, estado, expediente) son signals
locales de `AlumnosListContentComponent`. El componente se destruye al navegar: al abrir la ficha
de un alumno y volver, la lista aparece completa y hay que filtrar de nuevo.

Revisado en código el 2026-10-01 (el caso F10 no se había ejecutado en navegador).

**Decisión del owner (Matías, 2026-10-01):** los filtros y la búsqueda se conservan al salir de la
lista y volver.

## ACs Afectados

- AC-1: al volver a la Base de Alumnos dentro de la misma sesión, la búsqueda y los filtros de
  curso, estado y expediente siguen como se dejaron, y la tabla aparece filtrada.
- AC-2: "Limpiar filtros" los vacía, y siguen vacíos al volver.
- AC-3: se conservan igual en admin y en secretaria. No sobreviven a recargar la página ni a
  cerrar sesión.

## Cambio

- **Archivo:** `src/app/core/models/ui/alumno-table-row.model.ts` — interfaz `AlumnoListFilters`.
- **Archivo:** `src/app/core/facades/admin-alumnos.facade.ts` — signal `listFilters` y
  `setListFilters()`: el facade es un singleton, así que los filtros sobreviven a la navegación.
- **Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts`
  — input `initialFilters` (se aplica al crear el componente) y output `filtersChanged`.
- **Archivos:** `src/app/features/{admin,secretaria}/alumnos/*.component.ts` — conectan ambos con
  el facade.

Nota: los filtros viven en memoria, en el facade. Tal como quedó este fix se conservaban al
entrar a la lista por cualquier camino, incluso tras cerrar sesión. **Corregido en
`hotfix-126-m`**: solo se conservan al devolverse desde la ficha de un alumno.

## Test de Regresión

- `src/app/core/facades/admin-alumnos.facade.spec.ts > filtros de la lista — fix-275-m` ✓ (2 tests)
- `e2e/alumnos-b-lista.spec.ts > F10` ✓ — la búsqueda sigue puesta tras abrir una ficha y volver,
  y "Limpiar filtros" también se conserva.

## Verificación
Verificado el 2026-10-01: `npx vitest run` (2918 tests), `npm run lint:arch` (0 errores) y los dos
archivos E2E de Alumnos B (52/52 esperados) en verde. En navegador se probó la búsqueda; los
desplegables de curso, estado y expediente usan el mismo mecanismo y no se probaron uno por uno.
