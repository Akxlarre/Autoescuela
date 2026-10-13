# Fix: las variaciones de los KPI muestran los decimales con punto
> id: fix-400-m-porcentajes-kpi-con-punto-decimal
> refs: fix-395-m-testing-dashboards (caso E01) · spec 0044-b (AC11)
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

Dashboard ejecutivo, "Mes anterior" (2026-10-13): las variaciones se leen "76.7 %", "67.5 %" y
"79.1 %" en las tarjetas, y "▼ 97.1 % vs per. ant." en la tira del hero. En la misma pantalla el
margen ("71,3 %") y la tasa de cancelación ("82,6 %") van con coma, que es el formato chileno.

## Root Cause

Los tres componentes compartidos que pintan una tendencia convierten el número a texto con el
formato de JavaScript (punto decimal):

- `formatTrendDisplay()` (`core/utils/kpi-trend.utils.ts`, lo usa `app-kpi-card-variant`): `toFixed`.
- `SectionHeroComponent.getTrendDisplay()`: `String(Math.abs(trend))`.

## Fix

Un formateador único en `kpi-trend.utils.ts` con coma decimal y a lo más un decimal; lo usan los
tres componentes.

## Acceptance Criteria

- [x] AC1 — Una variación con decimales se muestra con coma en las tarjetas KPI ("+14,7 %", "76,7 %").
- [x] AC2 — Lo mismo en la tira de KPIs del hero ("▼ 97,1 %").
- [x] AC3 — Las variaciones enteras no cambian ("+3 %", "100 %").

## Regression Test

- `kpi-trend.utils.spec.ts` → coma decimal (fix-400-m)
- `kpi-trend.utils.spec.ts` → `formatTrendMagnitude (fix-400-m)`: el hero delega en ella

## Verificación (2026-10-13)

- Al implementar apareció un tercer formateador con el mismo defecto: `app-kpi-card`
  (`trendDisplay` y su `aria-label`). Los tres delegan ahora en `formatTrendMagnitude()` /
  `formatTrendDisplay()` de `kpi-trend.utils.ts`.
- Unit: `kpi-trend.utils.spec.ts` 8/8 (rojo → verde). `tsc` sin errores. El spec de `app-kpi-card`
  quedó actualizado a coma, pero está excluido de Vitest por configuración (`vitest.config.ts`).
- Navegador, ejecutivo: "Mes anterior" muestra "76,7 %", "67,5 %" y "79,1 %" en las tarjetas;
  "Este mes" muestra "▼ 97,1 % vs per. ant." en la tira del hero.

Fuera de alcance, anotado en `fix-395-m`: los KPI de Pagos (admin, secretaria, alumno) abrevian
montos con punto (`1.5M`); es del módulo Pagos (`ASG-i-028`).
