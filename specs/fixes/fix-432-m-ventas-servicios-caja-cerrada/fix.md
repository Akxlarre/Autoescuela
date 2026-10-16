# Fix: Una venta de servicio especial se puede borrar en un día con caja cerrada
> id: fix-432-m-ventas-servicios-caja-cerrada
> refs: fix-429-m-testing-servicios-especiales (caso J09) · fix-044-i · fix-051-i
> status: done
> closed: 2026-10-15
> created: 2026-10-15

## Root Cause

El candado de "Borrar venta" (`ServiciosEspecialesFacade.borrarVenta`) vivía solo en el navegador.
Desde la consola, la BD borraba una venta de un día con caja cerrada: probado el 2026-10-15 con la
venta #10 (27-08-2026, sede 2) en una transacción revertida. `guard_movimiento_caja_cerrada()`
(fix-044-i) cubre pagos, egresos y anticipos, pero no `special_service_sales`; lo mismo para
registrar o modificar una venta con fecha de un día cerrado (fix-051-i lo hizo solo para pagos).
El cierre guarda totales congelados (DG-065): cualquiera de las tres operaciones descuadra la Caja.

## ACs Afectados

Ninguno — fix autónomo. ACs propios:

- AC-1: la BD rechaza borrar, modificar o registrar una venta de un día con la caja de su sede
  cerrada, con un mensaje en español.
- AC-2: la otra sede ese mismo día, y cualquier día sin cierre, siguen funcionando igual.
- AC-3: si la BD rechaza el borrado desde la pantalla, se ve su mensaje (no "No se pudo borrar la
  venta").

## Cambio

- `supabase/migrations/20261015130000_fix432_ventas_servicios_caja_cerrada.sql` — trigger
  `guard_venta_servicio_caja_cerrada()` BEFORE INSERT/UPDATE/DELETE.
- `src/app/core/facades/servicios-especiales.facade.ts` — `borrarVenta()` devuelve el mensaje de
  la BD como `blockedReason` cuando es un rechazo de negocio (`P0001`).

## Test de Regresión

- `supabase/tests/caja/fix-432-m-ventas-servicios-caja-cerrada.sql` — 6 casos; todos "FALLA" en
  los 4 bloqueos sin la migración, todos "ok" con ella (ensayado en transacción revertida).
- `servicios-especiales.facade.spec.ts > fix-432-m: la BD rechaza el DELETE … muestra su mensaje`.
- Migración aplicada por Matías el 2026-10-15; test SQL re-ejecutado contra la BD real ✅.
