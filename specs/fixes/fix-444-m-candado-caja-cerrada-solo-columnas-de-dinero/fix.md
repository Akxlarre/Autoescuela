# Fix: "Eliminar definitivamente" un servicio falla si tiene ventas de días con caja cerrada
> id: fix-444-m-candado-caja-cerrada-solo-columnas-de-dinero
> refs: fix-432-m (regresión) · fix-024-i
> status: done
> closed: 2026-10-16
> created: 2026-10-16

## Root Cause

El trigger de `fix-432-m` (`guard_venta_servicio_caja_cerrada`) rechaza **cualquier** UPDATE de una
venta de un día con caja cerrada. `borrarServicioDefinitivo()` (`fix-024-i`) desvincula las ventas del
servicio con `UPDATE special_service_sales SET service_id = NULL` antes de borrarlo: si alguna de esas
ventas es de un día cerrado, el UPDATE falla y el servicio no se puede eliminar. Confirmado en la BD
real el 2026-10-16 con la venta #10 (27-08-2026, caja cerrada). Desvincular el servicio no cambia
ningún monto: el cierre de caja no se descuadra.

## ACs Afectados

- fix-432-m AC-1 se precisa: lo que no se puede modificar en un día cerrado son los datos que
  mueven la caja (monto, fecha, sede, medio de pago, cobrado, estado).

ACs propios:

- AC-1: desvincular el servicio (`service_id`) de una venta de un día cerrado se permite.
- AC-2: cambiar monto, fecha, sede, medio de pago, cobrado o estado de una venta de un día cerrado
  sigue rechazado; registrar o borrar en un día cerrado, también.

## Cambio

- `supabase/migrations/20261016120000_fix444_candado_caja_solo_columnas_de_dinero.sql` —
  `guard_venta_servicio_caja_cerrada()`: en UPDATE solo revisa la caja si cambia alguna columna de
  dinero.

## Test de Regresión

- `supabase/tests/caja/fix-432-m-ventas-servicios-caja-cerrada.sql` — caso nuevo 7 (desvincular el
  servicio de una venta de un día cerrado: ok); los 6 anteriores siguen ok.
