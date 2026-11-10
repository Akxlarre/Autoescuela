# Fix: El Excel/PDF de la Caja Diaria no cuadra con la pantalla
> id: fix-076-i-exporte-caja-no-cuadra
> refs: fix-073-i (casos E02, E04, E07, F15, M04 · sospecha S6) · ASG-i-029
> status: in_progress
> created: 2026-11-10
> priority: P1

## Root Cause

`generate-cash-closing-report` recalcula la caja con sus propias consultas en vez de usar el
mismo cálculo que la pantalla (`CuadraturaFacade`) o el snapshot guardado en `cash_closings`.
Confirmado en `fix-073-i` (sede 1, 2026-11-10):

- **Caja abierta:** fondo $0 (pantalla $50.000, el borrador no se lee); total $530.000 (pantalla
  $550.000: no consulta `special_service_sales`); efectivo $270.000 (290.000); saldo teórico
  $220.000 (290.000). Los pagos se filtran por `created_at`, la pantalla por `payment_date`.
- **Caja cerrada, exportada desde el detalle del Historial:** recalcula en vivo: total $810.000
  (suma un curso singular inscrito después del cierre), saldo teórico $540.000, junto a
  "Faltante $500" del arqueo guardado.
- **Anticipos:** se consultan sin filtro de sede (suma y lista los de la otra sede).
- **Formato:** el PDF no tiene columna Tarjeta (un abono con tarjeta sale "$0 $0 $0 … $10.000");
  el Excel la llama "Otro"; los egresos no muestran el medio de pago; la diferencia sale
  "Faltante: $500" arriba y "$-500" abajo, y el detalle en pantalla "− $-500".

## ACs Afectados

- `0002-i` / `fix-226-m` (exportes = pantalla).
- AC-1: con la caja abierta, el Excel y el PDF muestran el mismo fondo, total, efectivo, egresos
  y saldo teórico que la pantalla, incluidas las ventas de servicios especiales.
- AC-2: con la caja cerrada, el exporte usa los montos del snapshot de `cash_closings`; los
  movimientos posteriores no cambian el archivo.
- AC-3: los anticipos se filtran por la sede del instructor.
- AC-4: el PDF y el Excel tienen columna Tarjeta y medio de pago en los egresos.
- AC-5: un monto negativo lleva un solo signo en pantalla y en los archivos.

## Cambio

- **Archivo:** `supabase/functions/generate-cash-closing-report/index.ts` (+ el formateo de la
  diferencia en `detalle-cuadratura-modal`).
- **Qué cambia:** mismas reglas que la pantalla; snapshot si la caja está cerrada.

## Test de Regresión

- Test de la edge function (Deno) con un día de pagos, venta de servicio, anticipo de otra sede y
  cierre: totales del archivo = totales esperados.
