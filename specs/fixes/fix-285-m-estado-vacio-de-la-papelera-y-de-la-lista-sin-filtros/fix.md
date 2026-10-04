# Fix: Estado vacío de la Papelera y de la lista sin filtros
> id: fix-285-m-estado-vacio-de-la-papelera-y-de-la-lista-sin-filtros
> refs: ASG-i-024
> status: done
> closed: 2026-10-03
> created: 2026-10-03

## Root Cause
`app-alumnos-list-content` tiene un único estado vacío con el texto fijo "No se encontraron
alumnos · Intenta ajustar los criterios de búsqueda o filtros · Limpiar filtros". Ese texto solo
es cierto cuando hay un filtro o una búsqueda activa. Con la Papelera vacía y sin filtros le dice
al usuario que ajuste filtros que no puso, y le ofrece limpiar filtros que no existen. Es B28 de
la 2ª pasada de `fix-264-m` (`024a` M06).

## ACs Afectados
- `024a` M06: la Papelera vacía y sin filtros dice que no hay alumnos archivados, sin botón
  "Limpiar filtros".
- Con búsqueda o filtros activos el estado vacío no cambia (lista y Papelera).
- La lista normal vacía y sin filtros (sede sin alumnos) dice que aún no hay alumnos.

## Cambio
- **Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` —
  `emptyState` (computed) elige ícono, mensaje, subtítulo y acción según haya filtros activos y
  según sea la Papelera; lo usan los dos estados vacíos (tabla y tarjetas).

## Test de Regresión
- `alumnos-list-content.component.spec.ts > estado vacío (fix-285-m)` ✓ (4 tests)
- Sin cambio en `e2e/alumnos-b-lista.spec.ts > E10` (con búsqueda sigue "Limpiar filtros") ✓
