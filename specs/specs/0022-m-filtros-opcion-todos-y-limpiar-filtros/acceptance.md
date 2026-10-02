# Acceptance 0022-m — Opción "Todos" en los filtros y botón compartido "Limpiar filtros"

> Verificado: 2026-10-02 · Resultado: ✅ PASA 12/12 AC (9 más 3 casos borde), con visto bueno visual del owner.

## Evidencia general

- `ng build --configuration development`: sin errores ni advertencias.
- `npm run test:ci`: 228 archivos, 3048 tests en verde (5 omitidos, preexistentes).
- `npm run lint:arch`: 0 errores.
- Playwright (admin, 930 px de ancho): Base de Alumnos B y Flota, consola sin errores ni advertencias.

| AC | Estado | Evidencia |
|----|--------|-----------|
| AC1 | ✅ | Todas las opciones de filtro pasan por `withAllOption()`. Playwright: en Base de Alumnos la primera opción del selector Estado es "Todos los estados"; elegir "Retirado" deja 0 filas y volver a "Todos los estados" restaura la lista. Tests de opciones en alumnos-list, secretarias, pre-inscritos, pagos-recientes, historial-ventas, certificación B, auditoría. |
| AC2 | ✅ | La opción "todos" usa el mismo valor por defecto del signal (`''` o `null`), así que el selector muestra su texto. Playwright: "Todos los cursos", "Todos los tipos" visibles al cargar y tras limpiar. |
| AC3 | ✅ | `app-clear-filters-button` no renderiza nada con `active=false`. Tests `hasActiveFilters() === false` al inicio en cada pantalla con spec. Playwright: sin botón al cargar. |
| AC4 | ✅ | Playwright: el botón aparece al elegir "Retirado" (Base de Alumnos) y "Clase B" (Flota). Tests: selector o buscador → `hasActiveFilters() === true`. |
| AC5 | ✅ | Playwright: con texto "reyes" en el buscador, el botón dejó el buscador vacío; en Flota, el tipo volvió a "Todos los tipos". Test Base de Alumnos: limpiar vuelve a la página 1 (`tableFirst = 0`) y emite filtros vacíos. |
| AC6 | ✅ | Test existente "Limpiar filtros no quita el orden elegido" sigue en verde. |
| AC7 | ✅ | `showClear` eliminado en Promociones e Historial de ventas; ambas tienen opción "todos" + botón. Test historial-ventas. |
| AC8 | ✅ | Nuevo comunicado: `branchOptions`, `courseOptions`, `statusOptions` con "Todas las sedes" / "Todos" / "Cualquiera" (= `null`); sin `app-clear-filters-button` en el formulario. |
| AC9 | ✅ | `grep "Limpiar filtros"` en barras de filtro: solo `app-clear-filters-button` (Pagos admin/secretaria, Auditoría y Pre-inscritos migrados). Los enlaces dentro de `app-empty-state` se mantienen (AC-E3). |
| AC-E1 | ✅ | `resetFilters()` de la Base de Alumnos emite `filtersChanged` con filtros vacíos, así que lo guardado para la vuelta desde la ficha (hotfix-126-m) queda limpio. Test "limpiar deja todo en todos…" verifica la emisión. |
| AC-E2 | ✅ | Pantallas con default `''` (Base de Alumnos, Alumnos Profesional, Ex-Alumnos Profesional, Pre-inscritos, Contabilidad de cursos) reciben `withAllOption(…, '')`. Test: volver a `''` deja `hasActiveFilters() === false`. |
| AC-E3 | ✅ | El botón llama al mismo método que el enlace del estado vacío (`resetFilters`/`limpiarFiltros`/`resetFiltros`/`clearFilters`). Playwright: el enlace del estado vacío sigue presente junto al botón. |
