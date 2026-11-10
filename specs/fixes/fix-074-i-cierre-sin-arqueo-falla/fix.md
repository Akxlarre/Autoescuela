# Fix: Cerrar la caja sin arqueo falla siempre que haya efectivo esperado
> id: fix-074-i-cierre-sin-arqueo-falla
> refs: fix-073-i (caso D03) · ASG-i-029
> status: in_progress
> created: 2026-11-10
> priority: P0

## Root Cause

Encontrado en `fix-073-i`, tanda 2 (sede 2, 2026-11-10): "Cerrar Caja" con el arqueo apagado
devuelve 400 `new row for relation "cash_closings" violates check constraint "chk_arqueo_amount"`.

`buildCierrePayload()` (`core/facades/cuadratura.facade.ts`) arma, con el arqueo apagado,
`arqueoTotal = saldoTeoricoEfectivo()` y todas las cantidades de billetes/monedas en 0.
`chk_arqueo_amount` (`20260301000005_05_payments_and_finances.sql`) exige
`arqueo_amount IS NULL OR arqueo_amount = Σ cantidades × denominación`. Con saldo esperado ≠ 0
la fila nunca cumple: **sin arqueo solo se puede cerrar una caja con saldo esperado $0**.

El resto del flujo se comporta bien: el cierre no se guarda, la caja sigue abierta y el error se
ve en pantalla (fix-044-i).

## Decisión a confirmar

Un cierre sin conteo físico guarda `arqueo_amount = NULL` y `difference = NULL` (no hubo conteo,
no hay diferencia que medir), en vez de fingir un conteo igual al saldo esperado. Revisar que
Historial, el detalle, los exportes y el dashboard muestren "Sin arqueo" cuando
`arqueo_amount` es NULL (checklist F10) en vez de $0 o "Cuadrado".

## ACs Afectados

- `0004-i` / checklist D03: "Cerrar sin arqueo: botón habilitado; el cierre se guarda".
- AC-1: con el arqueo apagado y saldo esperado ≠ 0, "Cerrar Caja" guarda el cierre (`status
  closed`) sin error.
- AC-2: ese cierre se ve en Historial y en su detalle como "Sin arqueo", sin diferencia ni
  "Cuadrado"/"Descuadre".
- AC-3: con el arqueo encendido, el cierre sigue guardando el conteo y la diferencia como hoy.

## Cambio

- **Archivo:** `src/app/core/facades/cuadratura.facade.ts` (`buildCierrePayload` / `buildCierreRow`)
  y donde Historial/detalle/exportes leen `arqueo_amount`.
- **Qué cambia:** sin arqueo, `arqueo_amount` y `difference` van NULL; la UI lo muestra como
  "Sin arqueo".

## Test de Regresión

- `src/app/core/facades/cuadratura.facade.spec.ts > cerrarCaja sin arqueo guarda arqueo_amount null y no inventa conteo`
