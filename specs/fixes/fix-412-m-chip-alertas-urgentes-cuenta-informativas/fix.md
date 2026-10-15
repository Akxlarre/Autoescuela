# Fix: el chip "N alertas urgentes" cuenta también las alertas informativas
> id: fix-412-m-chip-alertas-urgentes-cuenta-informativas
> refs: fix-395-m-testing-dashboards (caso K11, sospecha S13c)
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

Dashboard de secretaria, sede 1 (2026-10-13): el chip rojo del hero dice "6 alertas urgentes", pero
una de las 6 es "62 alumnos listos para certificar", que se pinta en verde (éxito). Lo mismo pasa
con "N pagos registrados hoy" y con las alertas informativas. Con una sola alerta dice "1 alertas
urgentes".

## Root Cause

`SecretariaDashboardComponent.heroChips` usa `DashboardAlertsFacade.alertCount()`, que es el total
de alertas activas de cualquier gravedad, y arma el texto siempre en plural.

## Fix

El chip cuenta solo las alertas de gravedad `error` o `warning`, y concuerda en singular.

## Acceptance Criteria

- [x] AC1 — El chip cuenta solo alertas de error y de advertencia.
- [x] AC2 — Con solo alertas informativas o de éxito, el chip no aparece.
- [x] AC3 — Con una sola: "1 alerta urgente".

## Regression Test

- `secretaria-dashboard.component.spec.ts` → `chip de alertas urgentes (fix-412-m)`

## Verificación (2026-10-13)

- Unit: `secretaria-dashboard.component.spec.ts` 23/23, 3 tests nuevos (3 urgentes de 5 alertas;
  singular con una; sin chip si solo hay informativas o de éxito). `tsc` sin errores.
- En dev, la secretaria de la sede 1 tiene 6 alertas, una de éxito ("listos para certificar"): el
  chip pasa de "6 alertas urgentes" a "5 alertas urgentes".
