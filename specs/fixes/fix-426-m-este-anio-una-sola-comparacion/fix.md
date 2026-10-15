# Fix: con "Este año" cada KPI del ejecutivo muestra la misma comparación dos veces (y en enero, contra diciembre)
> id: fix-426-m-este-anio-una-sola-comparacion
> refs: fix-395-m-testing-dashboards (caso B12 / S17b, decisión de Matías 2026-10-14)
> status: done
> closed: 2026-10-14
> created: 2026-10-14

## Síntoma

Con el período "Este año", cada KPI del dashboard ejecutivo muestra dos líneas: "vs per. ant." y
"vs año ant.". Las dos comparan contra el mismo tramo del año anterior y dan el mismo porcentaje.
En enero, en cambio, "vs per. ant." compara contra diciembre, que para "Este año" no sirve.

## Root Cause

`buildExecKpiCards()` siempre arma las dos comparaciones. Para "Este año", `previousRange()` ya
devuelve el mismo tramo del año anterior (salvo en enero, donde el rango es de un solo mes y lo
trata como un mes: lo compara con diciembre). El rango no alcanza para distinguirlo: en enero,
"Este año" y "Este mes" son el mismo rango, y para "Este mes" sí corresponde comparar con
diciembre.

## Fix

Decisión de Matías: con "Este año", una sola comparación, siempre "vs año anterior" (mismo tramo
del año pasado), también en enero.

- `buildExecKpiCards()` recibe el preset. Con `this_year`, la comparación principal es la del año
  anterior y no hay segunda línea.
- `toHeroKpi()` rotula esa comparación "vs año ant." en vez de "vs per. ant."; sin base, el hero
  dice "Sin base el año anterior" en vez de quedar en blanco.
- Los demás presets no cambian.

## Acceptance Criteria

- [x] AC1 — Con "Este año", cada KPI muestra una sola comparación, "vs año anterior".
- [x] AC2 — Con "Este año" en enero, la comparación sigue siendo contra el año anterior (no contra
  diciembre).
- [x] AC3 — Con los demás presets siguen las dos comparaciones.

## Regression Test

- `executive-dashboard.utils.spec.ts` → `fix-426-m`

## Verificación (2026-10-14)

- Unit: 5 tests nuevos en el spec de utils del ejecutivo. Con los specs del dashboard: 98/98.
  `tsc` sin errores. AC2 (enero) sale por construcción: con `this_year` solo se usa la comparación
  con el año anterior, que nunca es diciembre.
- Navegador, admin, con la consulta de 2025 interceptada para tener base (la BD de dev no tiene
  datos de 2025): "Este mes" sigue con las dos líneas ("vs período anterior" y "vs año anterior");
  "Este año" muestra una sola: "+101,9 % vs año anterior" en las tarjetas y "▲ 49 % vs año ant." en
  el hero. Sin interceptar, "Sin base el año anterior".
