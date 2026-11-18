# Fix: Historial de cierres y Liquidaciones dejan avanzar a meses futuros
> id: fix-079-i-sin-meses-futuros-historial-liquidaciones
> refs: fix-073-i (caso F04, decisión de Ignacio 2026-11-17)
> status: done
> closed: 2026-11-17
> created: 2026-11-17
> priority: P2

## Root Cause

`mesSiguiente()` de `HistorialCuadraturasFacade` y `LiquidacionesFacade` suma un mes sin tope, y
la flecha "siguiente" de `historial-cuadraturas-content` y `liquidaciones-content` siempre está
habilitada: se llega a meses que no existen todavía y la pantalla sale vacía.

## ACs Afectados

Ninguno — fix autónomo (decisión F04 de `fix-073-i`):
- AC-1: en el mes actual (hora Chile), la flecha "Mes siguiente" del historial y de Liquidaciones
  está deshabilitada; en un mes pasado está habilitada.
- AC-2: `mesSiguiente()` no avanza más allá del mes actual aunque se llame directo.

## Cambio

- `core/utils/month-nav.utils.ts` (nuevo): `puedeAvanzarMes(anio, mes, now)`, función pura.
- `historial-cuadraturas.facade.ts` y `liquidaciones.facade.ts`: computed `puedeAvanzarMes` y
  tope en `mesSiguiente()`.
- `historial-cuadraturas-content` y `liquidaciones-content`: input `puedeAvanzarMes` → `[disabled]`.
- Las 4 páginas (admin/secretaria × historial/liquidaciones) pasan el input.

## Test de Regresión

- `src/app/core/utils/month-nav.utils.spec.ts`
- `historial-cuadraturas.facade.spec.ts` / `liquidaciones.facade.spec.ts` > tope de `mesSiguiente()`
- Corrida 2026-11-17: `month-nav.utils.spec.ts` (5) + los dos specs de facades: 47/47 ✓. Los tests
  viejos "mesSiguiente should increment" asumían que se podía avanzar desde el mes actual; se
  reemplazaron por "vuelve al mes actual desde el anterior" y "no pasa del mes actual".
  `ng build` ✓, `npm run lint:arch`: 0 errores.

## Verificación (2026-11-17, navegador, admin)

- Historial y Liquidaciones en noviembre 2026: "Mes siguiente" deshabilitado (atenuado). Mes
  anterior → habilitado; volver a noviembre → deshabilitado otra vez. AC-1 ✓, AC-2 por test.
  Consola sin errores.
