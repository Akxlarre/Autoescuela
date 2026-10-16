# Fix: El Historial de ventas no tiene buscador
> id: fix-439-m-historial-ventas-buscador
> refs: fix-429-m-testing-servicios-especiales (caso I10) · fix-239-m
> status: done
> closed: 2026-10-15
> created: 2026-10-15

## Root Cause

El drawer "Historial de Ventas" (`fix-239-m`) solo filtra por servicio y período. Para encontrar
la venta de un cliente hay que recorrer la lista a ojo, y una venta fuera del período elegido no
aparece aunque se conozca el RUT.

**Decisión de Matías (2026-10-15, I10):** buscador por nombre o RUT del cliente, en el navegador.

## ACs Afectados

Ninguno — fix autónomo. ACs propios:

- AC-1: el buscador encuentra por nombre (sin distinguir mayúsculas ni tildes), por RUT (con o sin
  puntos y guion) y por N° de boleta.
- AC-2: con una búsqueda escrita se recorre todo el historial cargado, no solo el período elegido
  (mismo criterio que las demás listas, `applyPeriodWindow`).
- AC-3: la búsqueda cuenta como filtro activo y "Limpiar filtros" la borra.

## Cambio

- `features/admin/servicios-especiales/historial-ventas-drawer.component.ts` — signal `busqueda`,
  input de búsqueda (mismo diseño que Pagos Recientes) y `filterBySearchTokens` en
  `ventasFiltradas`.

## Test de Regresión

- `historial-ventas-drawer.component.spec.ts > buscador por cliente o RUT (fix-439-m)` — 5 casos.
