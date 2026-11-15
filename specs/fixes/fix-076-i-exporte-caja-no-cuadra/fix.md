# Fix: El Excel/PDF de la Caja Diaria no cuadra con la pantalla
> id: fix-076-i-exporte-caja-no-cuadra
> refs: fix-073-i (casos E02, E04, E07, F15, M04 · sospecha S6) · ASG-i-029
> status: done
> closed: 2026-11-15
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

- **Nuevo `supabase/functions/_shared/cash-closing-report.ts`:** copia espejo del cálculo de
  `CuadraturaFacade`: `ingresoByMethod()` (columna por medio de pago, tarjeta incluida),
  `resolveCajaTotals()` (caja abierta: fondo + efectivo − egreso en efectivo; caja cerrada: los
  montos del snapshot), `rowsAtClose()` (omite lo registrado después del cierre),
  `diferenciaLabel()` ("Faltante: $500", un solo signo) y `paymentMethodLabel()`.
- **`supabase/functions/generate-cash-closing-report/index.ts`:**
  - pagos por `payment_date` con los estados que suman (antes `created_at` y solo `paid`);
  - suma las ventas de servicios especiales cobradas;
  - anticipos filtrados por la sede del instructor;
  - lee la fila del día también en borrador: el fondo de la caja abierta es el de la pantalla;
  - caja cerrada: totales del snapshot y detalle hasta `closed_at`; el estado dice "montos del
    cierre guardado";
  - columna Tarjeta en el PDF y el Excel (antes "Otro" / sin columna), medio de pago en egresos.
- **`detalle-cuadratura-modal`:** la diferencia se muestra "− $500" (antes "− $-500").

## Test de Regresión

- `supabase/functions/_shared/cash-closing-report.test.ts` (Deno) ✓ 7/7: caja abierta = pantalla
  (fondo del borrador + servicio especial: $550.000 / efectivo $290.000), caja cerrada = snapshot
  aunque haya un ingreso posterior ($810.000 → $550.000), cierre antiguo sin `cash_expenses`,
  corte por `closed_at`, diferencia con un solo signo, nombres de medio de pago.
- `deno check` de la función: solo el error `Uint8Array` → `Response` que ya existía. `npm run
  lint:arch`: 0 errores.
- Base (solo lectura, 2026-11-15): sede 1, 10-11-2026, cerrada → snapshot fondo $50.000, ingresos
  $550.000, efectivo $290.000, egresos $65.000 ($50.000 en efectivo), saldo teórico $290.000,
  diferencia −$500. Es lo que el archivo debe mostrar (antes $810.000 / $540.000).

## Verificación (2026-11-15, función desplegada con autorización de Ignacio)

Llamada real a `generate-cash-closing-report` con la sesión de `admin@test.com`, sede 1:

- **10-11-2026 (cerrada), Excel:** "Estado: Caja Cerrada (montos del cierre guardado)" · Fondo
  $50.000 · Ingresos $550.000 · Efectivo $290.000 · Egresos $65.000 ($50.000 en efectivo, $15.000
  tarjeta/transferencia) · Saldo teórico $290.000 · Físico $289.500 · Diferencia "Faltante: $500".
  La fila TOTAL del detalle suma lo mismo: efectivo $290.000, transferencia $30.000, tarjeta
  $10.000, total $550.000 (antes $810.000 / $540.000). Columnas "Tarjeta" y "Medio de pago".
  AC-2 ✓ AC-4 ✓ AC-5 ✓
- **10-11-2026, PDF:** 200 `application/pdf`; contiene $550.000, $290.000, $65.000, "Faltante:
  $500", "Tarjeta", "Medio de pago"; ningún "$-". AC-2 ✓ AC-4 ✓ AC-5 ✓
- **15-11-2026 (abierta, sin movimientos):** 200, todo en $0. AC-1 y AC-3 quedan cubiertos por el
  test Deno (caja abierta = cálculo de la pantalla) y por las mismas consultas que
  `CuadraturaFacade` (servicios especiales; anticipos por `instructors.users.branch_id`).
