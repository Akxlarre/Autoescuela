# Tasks 0023-m — Exportar y ordenar por columna en Ex-Alumnos B, Base de Alumnos Profesional y Ex-Alumnos Profesional

> **Plan:** [plan.md](./plan.md)

## 1. Lógica de orden compartida

- [x] `core/utils/table-sort.utils.ts` + spec: `sortRows`, `nextSort`, `toggleSortDirection`,
  `ariaSortOf`, `sortIconOf` y claves `textSortKey` / `dateSortKey` / `rutSortKey`.
- [x] `core/utils/alumnos-sort.utils.ts` delega en `table-sort.utils` (mismas exports; su spec
  sigue verde — AC-E2).

## 2. Componentes compartidos

- [x] `app-sort-header` (botón del título + flecha; CSS movido desde alumnos-list-content).
- [x] `app-sort-control` ("Ordenar por" + sentido para tarjetas).
- [x] Base Alumnos B usa ambos sin cambiar comportamiento.

## 3. Ex-Alumnos B

- [x] `core/utils/egresados-sort.utils.ts` + spec ("Año / Sede" → fecha de egreso; "Estado
  cuenta" → saldo pendiente).
- [x] `ex-alumnos-content`: orden en tabla y tarjetas, vuelve a página 1 al ordenar, exporta
  las filas ordenadas, "Limpiar filtros" conserva el orden.
- [x] Tests de componente (ciclo del orden, página 1, exportación ordenada, limpiar filtros).

## 4. Base de Alumnos Profesional

- [x] `core/utils/alumnos-profesional-sort.utils.ts` + spec (asistencia por semáforo).
- [x] `core/utils/alumnos-profesional-export.utils.ts` + spec (Excel y PDF).
- [x] `alumnos-profesional-list-content`: orden + `app-export-menu` + output `exportRequested`.
- [x] `AdminAlumnosProfesionalFacade.exportAlumnos()` + `isExporting`.
- [x] Páginas admin y secretaria conectadas.

## 5. Ex-Alumnos Profesional

- [x] `egresados-export.utils` acepta la etiqueta del Nº (Expediente / Matrícula).
- [x] `ExAlumnosFacade.exportEgresados(format, rows, group)`.
- [x] `ex-alumnos-profesional-content`: orden + export.
- [x] Páginas admin y secretaria conectadas.

## 6. Validación e índices

- [x] `ng build`, `npm run test:ci` (3080 ✓), `npm run lint:arch` (0 errores).
- [x] `/verify` en las cuatro listas (ver acceptance.md).
- [x] `indices/COMPONENTS.md` (manual + sync), `UTILS.md`, `USAGE-MAP.md`.
- [x] Extra encontrado en `/verify`: el skeleton de la Base Profesional usaba `track` con
  claves repetidas (NG0955) → `track $index`.
