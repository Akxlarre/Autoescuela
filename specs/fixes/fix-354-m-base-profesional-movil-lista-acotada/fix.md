# Fix: en móvil la Base Profesional pinta todas las tarjetas y la lista se monta sobre el encabezado
> id: fix-354-m-base-profesional-movil-lista-acotada
> refs: fix-319-m-testing-clase-profesional-piloto (U07, F05) · ASG-i-025
> status: done
> closed: 2026-10-07
> created: 2026-10-07

## Root Cause
La vista de tarjetas de `app-alumnos-profesional-list-content` itera `sortedAlumnos()` completo:
con 65 matrículas la celda de la lista mide ~22.000 px. La animación de entrada del bento grid
escala cada celda desde su centro, y un 1 % de escala sobre 22.000 px desplaza el borde superior
~110 px: la lista entra ~800 px más abajo y luego se monta ~100 px sobre los KPIs del hero hasta
que la animación termina (medido a 375 px el 2026-10-07, bloque 5 de `fix-319-m`).

La Base B no lo sufre porque su vista de tarjetas ya muestra de a 6 con "Cargar más"
(`sliceByBudget`, spec 0028); la lista Profesional nunca recibió ese patrón.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- `src/app/shared/components/alumnos-profesional-list-content/alumnos-profesional-list-content.component.ts`
  — la vista de tarjetas muestra de a 6 con "Cargar más (N restantes)", igual que la Base B
  (`sliceByBudget` de `core/utils/layout-tier.utils.ts`). Buscar, filtrar, ordenar, limpiar
  filtros o cambiar a la Papelera vuelven a las primeras 6. La tabla de escritorio y la
  exportación no cambian (siguen usando la lista completa).

## Test de Regresión
- Unit (`alumnos-profesional-list-content.component.spec.ts`): con 20 filas se muestran 6 y
  quedan 14; "Cargar más" suma 6; buscar, ordenar y limpiar filtros vuelven a 6; con 4 filas no
  queda nada por cargar.
- Navegador a 375 px: la celda de la lista ya no se monta sobre el hero durante la entrada y el
  botón "Cargar más" funciona.

## Progreso
- [x] Test unitario en rojo (5 fallan) y luego en verde (14/14 del archivo).
- [x] Implementación. `tsc` sin errores; `lint:arch` sin avisos nuevos.
- [x] Revisión en navegador (admin): a 375 px la celda de la lista mide ~2.500 px (antes
  ~22.000) y durante la entrada nunca se monta sobre el hero (separación de 126 px a 0, antes
  llegaba a −98 px). 6 tarjetas y "Cargar más (59 restantes)"; un clic deja 12; al buscar
  "E2E" quedan las 5 coincidencias sin botón. A 1440 px la tabla sigue con 10 filas y paginador
  "1 a 10 de 65", el documento no scrollea. Consola sin errores.
