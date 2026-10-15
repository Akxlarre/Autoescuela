# Fix: "Ingresos Mes" de secretaria se lee mal y se compara contra el mes anterior completo
> id: fix-399-m-ingresos-mes-secretaria-formato-y-comparacion
> refs: fix-395-m-testing-dashboards (casos K07, K08, sospecha S10) · spec 0044-b AC11 (misma regla de comparación)
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

Dashboard de secretaria, KPI "Ingresos Mes":

- Se muestra en millones con punto decimal y sin redondeo: `$0M`, `$0.845M`, `$1.234567M`.
- La tendencia "% vs mes pasado" compara lo que va del mes contra el mes anterior **completo**: a
  principio de mes casi siempre sale en rojo (el 13 de octubre de 2026, "▼ 100 %").

## Root Cause

`DashboardFacade.fetchRealDashboardData()` entrega el KPI como `revenue / 1000000` con sufijo `M`,
y el hero imprime el número tal cual. La consulta del período anterior va del día 1 al último día
del mes anterior, mientras la del mes en curso va del día 1 a hoy.

## Fix

- El KPI entrega el monto completo con formato chileno (`$1.234.567`), sin sufijo.
- El período anterior es el mismo tramo del mes pasado (día 1 → mismo día del mes), la regla que ya
  usa el Dashboard ejecutivo (AC11 de `0044-b`). Si el mes pasado no tiene ese día, llega hasta su
  último día.

## Acceptance Criteria

- [x] AC1 — "Ingresos Mes" muestra el monto completo en pesos con separador de miles (`$1.500.000`,
      `$0`), sin "M".
- [x] AC2 — El % compara contra el mismo tramo del mes anterior (el 13 de octubre: 1–13 de
      septiembre).
- [x] AC3 — El 31 de marzo compara contra todo febrero.

## Regression Test

- `dashboard.facade.spec.ts` → `KPI "Ingresos Mes": formato y tramo comparable (fix-399-m)`

## Verificación (2026-10-13)

- Unit: `dashboard.facade.spec.ts` y `secretaria-dashboard.component.spec.ts`, 38/38 (los tests
  nuevos, rojo → verde). `tsc` sin errores.
- Diseño final: el Facade entrega el monto completo como número (`value: 1234567`, prefijo `$`, sin
  sufijo) y el componente le pone el separador de miles a todos los KPIs del hero.
- Navegador, secretaria de la sede 2 el 13 de octubre: "Ingresos Mes $180.000 · ▼ 89 % vs mes
  pasado" (antes `$0.18M`). Las consultas del período anterior piden `payment_date` y `sale_date`
  entre `2026-09-01` y `2026-09-13`.
