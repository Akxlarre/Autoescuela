# Hotfix: Cabecera 4/3 columnas + skeletons fieles al espaciado real (Libro de Clases)

> id: hotfix-039-m-libro-clases-cabecera-columnas-skeletons
> status: in-progress
> created: 2026-07-22

## Problema
1. En la Cabecera, la columna izquierda tiene 3 campos (Autoescuela, Curso,
   ID) y la derecha 4 (Promoción, Fecha inicio, Fecha término, Dirección) —
   el dueño pide 4 a la izquierda y 3 a la derecha.
2. El skeleton de `isLoadingSections` no refleja el espaciado real de la
   card Cabecera: al bloque "Datos del Libro de Clases" le faltan las líneas
   de `<label>` sobre cada input (el real tiene label + input, el skeleton
   solo mostraba el input), y el conteo de líneas por columna no coincidía
   con los campos reales tras el reorden.

## Fix
`features/libro-de-clases/libro-de-clases.component.ts`:
- Cabecera: mueve "Promoción" a la columna izquierda (después de "ID"),
  dejando izquierda = Autoescuela/Curso/ID/Promoción (4) y derecha = Fecha
  inicio/Fecha término/Dirección (3).
- Skeleton de `isLoadingSections`: reescrito para reutilizar exactamente las
  mismas clases de espaciado que el contenido real (`space-y-2`, `gap-4`,
  `mt-4`, `mb-1`, `mt-3 flex items-center gap-3`) y el mismo conteo de líneas
  por columna (4 y 3), agregando las líneas de `<label>` que faltaban sobre
  cada input de "Datos del Libro de Clases".

## Cierre
- `tsc --noEmit` limpio.
- `npm run test:ci` sigue en verde (sin tests dependientes del orden de
  campos ni del skeleton).
- Sin verificación visual con Playwright (MCP inactivo en esta sesión).
