# Fix: Un filtro de deudores sin resultados deja la lista en blanco, sin mensaje
> id: fix-055-i-deudores-filtro-sin-resultados-en-blanco
> refs: fix-048-i-testing-pagos-y-descuentos (B3-2, caso D09)
> status: done
> closed: 2026-10-15
> created: 2026-10-15

## Root Cause

La lista "Alumnos con saldo pendiente" de Pagos (admin y secretaria) distingue cargando / sin
deudores (`facade.alumnosConDeuda().length === 0`) / lista. Cuando hay deudores pero los filtros
(fechas, curso) no dejan ninguno, cae en la rama de lista: muestra los encabezados de columna y
ninguna fila, sin decir por qué ni cómo volver.

## ACs Afectados

Ninguno de una spec — bug encontrado en testing (`fix-048-i` B3-2). Criterios de este fix:

- **AC-F1:** con deudores y filtros que no dejan ninguno, se ve "Ningún alumno coincide con los
  filtros" con un botón "Limpiar filtros" que deja la lista completa (admin y secretaria).
- **AC-F2:** sin deudores sigue "¡Sin saldos pendientes!"; con resultados, la lista no cambia.

## Cambio

- **Archivo:** `src/app/features/admin/pagos/admin-pagos.component.ts`
- **Archivo:** `src/app/features/secretaria/pagos/secretaria-pagos.component.ts`
- **Qué cambia:** `computed` `sinResultadosPorFiltro` (hay deudores y los filtros no dejan
  ninguno) y rama `@else if (sinResultadosPorFiltro())` con `<app-empty-state>` y acción
  "Limpiar filtros" (`limpiarFiltros()`). El test cubre la decisión: renderizar la página completa
  en el test choca con un input requerido de otro componente.

## Test de Regresión

- `admin-pagos.component.spec.ts` y `secretaria-pagos.component.spec.ts` (filtro sin resultados →
  estado vacío con acción; limpiar → lista completa).
- QA Playwright como secretaria: curso "Profesional" sin deudores.

## Verificación

- 2026-10-15: specs de admin y secretaria 47/47, suite completa 4194, `tsc` limpio, `lint:arch`
  0 errores. QA Playwright como secretaria: curso "Profesional" → "Ningún alumno coincide con los
  filtros" + "Limpiar filtros"; al limpiar vuelven las filas.
