# Hotfix: Fondo inicial hardcodeado en $50.000 (asunción obsoleta)
> id: hotfix-002-i-fondo-inicial-hardcodeado
> refs: —
> status: in_progress
> created: 2026-08-06

## Problema
La asunción original ("la caja siempre arranca con $50.000 para dar vuelto") quedó obsoleta —
el cliente confirmó que el arqueo de efectivo es opcional y el usuario ingresa el monto real con
el que abre caja ese día. Quedaron 2 vestigios de la asunción vieja, confirmados con el usuario
(2026-08-06):

1. `CuadraturaFacade.fondoInicial` arranca en `signal<number>(50_000)` — si el usuario no
   sobreescribe el input "Fondo de Apertura", se guarda ese default como si fuera real.
2. En el detalle de una cuadratura cerrada (`app-detalle-cuadratura-modal`): las tarjetas KPI
   "Saldo Sistema"/"Diferencia" y la fila "Fondo Inicial" dentro de "Conciliación Operativa"
   muestran cifras derivadas de un fondo inicial que **no se persiste por cierre** —
   `mapCierreToHistorial()` hardcodea `fondoInicial: 50_000` siempre, sin relación con lo
   ingresado ese día (`cash_closings` no tiene columna `fondo_inicial`).

## Cambios
- **Archivo:** `src/app/core/facades/cuadratura.facade.ts` — `fondoInicial` default de `50_000`
  a `0`. El input sigue editable; el usuario decide si hay fondo o no, sin asunción implícita.
- **Archivo:** `src/app/shared/components/detalle-cuadratura-modal/detalle-cuadratura-modal.component.ts`
  — quitar las tarjetas KPI "Saldo Sistema" y "Diferencia" (queda solo "Saldo Físico"); quitar la
  fila "Fondo Inicial" de la sección "Conciliación Operativa" (queda Ingresos/Egresos/Cierre
  Total, todos derivados del arqueo real, no de una asunción).

## Resultado
- `CuadraturaFacade.fondoInicial` default `50_000` → `0`.
- Detalle de cuadratura: grid de KPIs reducido a solo "Saldo Físico"; "Conciliación Operativa"
  sin la fila "Fondo Inicial" (quedan Ingresos Registrados / Egresos / Cierre Total).
- `cuadratura.facade.spec.ts`: 3 tests actualizados (asumían el default viejo de $50.000) —
  23/23 verdes.
- Sin regresión: `historial-cuadraturas.facade.spec.ts` (13/13) y
  `registrar-ajuste-cuadratura-drawer.component.spec.ts` (15/15) siguen verdes.
- `tsc --noEmit` limpio, `lint:arch` exit 0.
