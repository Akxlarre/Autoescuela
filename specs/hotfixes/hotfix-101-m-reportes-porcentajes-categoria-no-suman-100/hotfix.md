# Hotfix: Reportes Contables — los porcentajes por categoría no suman 100%
> id: hotfix-101-m-reportes-porcentajes-categoria-no-suman-100
> refs: —
> status: done
> closed: 2026-09-09
> created: 2026-09-09

## Problema

En "Ingresos por Categoría" y "Gastos por Categoría" del reporte, cada `porcentaje` se
redondea a 1 decimal de forma independiente (`Math.round((monto / total) * 1000) / 10`),
así que la suma de las filas da 99.9% o 100.1% en vez de 100% exacto (ej. visto en pantalla:
46.4 + 32.1 + 21.4 = 99.9).

## Cambios

- **Archivo:** `src/app/core/utils/reportes-contables.utils.ts` — nueva función pura interna
  `distributePercentages(montos: number[], total: number): number[]` que reparte los
  porcentajes a 1 decimal por el método del resto mayor (largest remainder / Hamilton):
  redondea cada uno hacia abajo, y suma +0.1 a las categorías con mayor resto hasta que la
  suma sea exactamente 100.0. `computeIngresosCategoria()` y `computeGastosCategoria()` la
  usan para poblar el campo `porcentaje` en vez del `Math.round(...)` por fila.
- **Archivo:** `src/app/core/utils/reportes-contables.utils.spec.ts` — casos: la suma de
  `porcentaje` de las filas es exactamente 100 cuando el redondeo ingenuo daría 99.9/100.1;
  total 0 → todos 0; una sola categoría → 100.0.
