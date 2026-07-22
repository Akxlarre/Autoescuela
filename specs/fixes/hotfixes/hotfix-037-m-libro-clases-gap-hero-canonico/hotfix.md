# Hotfix: Espacio muerto entre el hero y la primera card en Libro de Clases

> id: hotfix-037-m-libro-clases-gap-hero-canonico
> status: done
> created: 2026-07-21

## Problema
En `admin-libro-de-clases.component.ts`, `.bento-grid` usa el default
`--bento-row-min: 120px` (`_bento-grid.scss:33,49`). El hero en `density="slim"`
(y las secciones colapsadas del libro) miden menos de 120px de contenido real,
pero el grid fuerza esa fila a 120px igual, dejando un hueco vacío visible antes
de la card de Filtros.

## Fix
Mismo patrón ya aplicado en `admin-profesional-evaluaciones.component.ts`
(comentario `// candidato a Asistencia / Libro de Clases`): sobrescribir
`--bento-row-min: auto` en el `.bento-grid` local del componente, para que cada
fila mida según su contenido real en vez de imponer un piso arbitrario.

- **Archivos** (mismo componente duplicado admin/secretaria):
  - `src/app/features/admin/libro-de-clases/admin-libro-de-clases.component.ts`
  - `src/app/features/secretaria/libro-de-clases/secretaria-libro-de-clases.component.ts`
  — agregado bloque `.bento-grid { --bento-row-min: auto; }` en `styles` de ambos.

## Cierre
- `tsc --noEmit` limpio en ambos archivos.
- Sin verificación visual con Playwright (MCP inactivo en esta máquina, ver
  `project_test_baseline_jun2026`) — el fix replica 1:1 un patrón ya en producción
  en `admin-profesional-evaluaciones.component.ts`, que ya tenía comentado este
  mismo caso como candidato pendiente.

## AC
- El hero slim y la card de Filtros (y las secciones colapsadas) quedan
  separados solo por el gap canónico del bento-grid, sin hueco extra.
- No se rompe el piso de 120px en grids que sí lo necesitan (KPIs/squares) —
  el override es local al `.bento-grid` de esta página, no global.
