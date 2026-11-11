# Fix: liquidaciones redondea suma de horas y sueldo base CLP sin deriva flotante
> id: fix-250-b
> refs: 0014-m-tarifa-hora-instructores-por-sede
> status: done
> closed: 2026-11-11
> created: 2026-11-11

## Root Cause
`instructor_monthly_hours.total_equivalent` es `NUMERIC(6,1)` en PostgreSQL. Al operar con IEEE-754 en JS:
1. En `generate-payroll-report`, sumar `r.totalHours` directo en PDF y Excel producía deriva (ej. `2.3 + 2.3 + 2.3 + 3 = 9.899999999999999`), desbordando la columna `HRS` (`w: 38`) sobre `BASE (GANADO)` y exportando el valor crudo en Excel.
2. Multiplicar `totalHours * amountPerHour` sin `Math.round()` en `generate-payroll-report` y en `LiquidacionesFacade.fetchLiquidacionesData` podía producir sueldos base no enteros (ej. `2.3 * 7000 = 16099.999999999998`), ensuciando el Excel o fallando al persistir `base_salary INTEGER NOT NULL` en `instructor_monthly_payments`.

## ACs Afectados
- 0014-m (AC3/AC4): `totalBaseAmount` debe resolverse como entero CLP exacto al aplicar la tarifa por hora de la sede del instructor; el reporte de nómina (PDF y Excel) debe totalizar las horas a 1 decimal y los montos base sin deriva flotante.

## Cambio
- **Archivo:** `supabase/functions/_shared/payroll-totals.ts`
- **Qué cambia:** funciones puras `roundPayrollHours`, `sumPayrollHours` y `calcPayrollBaseAmount`.
- **Archivo:** `supabase/functions/generate-payroll-report/index.ts`
- **Qué cambia:** normaliza horas por fila, redondea `totalBaseAmount` a entero CLP y centraliza `totalHoras` para PDF y Excel.
- **Archivo:** `src/app/core/facades/liquidaciones.facade.ts`
- **Qué cambia:** normaliza `totalHours` a 1 decimal y redondea `totalBaseAmount` con `Math.round(totalHours * amountPerHour)`.

## Test de Regresión
- `supabase/functions/_shared/payroll-totals.test.ts` (4/4 `deno test`) ✓
- `src/app/core/facades/liquidaciones.facade.spec.ts > redondea totalBaseAmount a entero CLP cuando horas NUMERIC(6,1) × tarifa produce deriva flotante` (16/16 `vitest`) ✓
