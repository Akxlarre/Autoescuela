# Fix: Eliminar desde la Caja una venta de servicio especial la deja huérfana
> id: fix-437-m-revertir-venta-servicio-desde-caja-la-borra
> refs: fix-429-m-testing-servicios-especiales (S9, casos L08, B06, I12) · fix-024-i · fix-025-i
> status: in_progress
> created: 2026-10-15

## Root Cause

`CuadraturaFacade.eliminarIngreso()` trata la venta de servicio especial como un cobro a revertir
(`fix-024-i`): pone `paid = false, status = 'pending'`. Desde `fix-025-i` el módulo ya no tiene
ventas pendientes ni forma de cobrarlas (`registrarCobro()` no tiene botón), así que la venta queda
huérfana: sigue contando en "Ventas Totales" y "Ventas del mes", sale de "Recaudación" y el export
la muestra como "Pendiente". En dev ya hay una así (#3).

**Decisión de Matías (2026-10-15, L08):** eliminar el ingreso de una venta desde la Caja la borra,
con el mismo candado de caja cerrada que el borrado desde el Historial.

## ACs Afectados

Ninguno — fix autónomo. ACs propios:

- AC-1: "Eliminar ingreso" de una venta de servicio especial en la Caja borra la venta; deja de
  aparecer en la Caja, en el Historial y en los KPIs del módulo.
- AC-2: si la RLS no deja borrar (0 filas) o la caja del día está cerrada (trigger de
  `fix-432-m`), no se muestra éxito.

## Cambio

- `core/facades/cuadratura.facade.ts` — rama `special_service` de `eliminarIngreso()`: DELETE con
  `assertWriteOk(requireRows)` en vez de revertir el cobro.

## Test de Regresión

- `cuadratura.facade.spec.ts > fix-437-m: eliminar el ingreso de un servicio especial BORRA la venta`.
- `cuadratura.facade.spec.ts > eliminar un servicio especial que no toca filas no muestra éxito`.
