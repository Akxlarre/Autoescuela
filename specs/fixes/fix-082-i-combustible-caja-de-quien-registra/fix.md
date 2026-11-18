# Fix: el combustible queda en la caja de quien lo registra, sea cual sea la sede del auto
> id: fix-082-i-combustible-caja-de-quien-registra
> refs: fix-073-i (C07, decisión de Ignacio 2026-11-18)
> status: done
> closed: 2026-11-18
> created: 2026-11-18

## Root Cause
`resolveFuelExpenseBranch()` cargaba el combustible a la sede del vehículo (fix-243-m). Solo los
vehículos "Ambas" iban a la caja de quien registra (hotfix-084-b). Si la secretaria de la sede 1
pagaba con su caja la carga de un auto de la sede 2, el egreso aparecía en la caja de la sede 2:
la sede 1 quedaba con plata de menos y la 2 con un egreso que nadie pagó.

## ACs Afectados
- C07 (checklist de fix-073-i): el combustible se imputa a la caja donde se registra, como el
  resto de los egresos.
- Se mantiene de fix-243-m: con el admin en "Todas las sedes" el egreso nunca queda sin sede
  (usa la sede del vehículo, o la elegida en el formulario si el vehículo no tiene).

## Cambio
- **Archivo:** `src/app/core/utils/fuel-expense-branch.utils.ts` (+ spec) — la sede activa de
  quien registra manda; la del vehículo solo cuando el admin está en "Todas las sedes".
- **Archivo:** `registrar-egreso-drawer.component.ts` (+ spec) — comentario y test.

## Test de Regresión
- `fuel-expense-branch.utils.spec.ts > vehículo de otra sede: queda en la caja de quien registra` ✓
- `registrar-egreso-drawer.component.spec.ts > C07 (fix-082-i): combustible de un auto de otra sede queda en la caja de quien registra` ✓
