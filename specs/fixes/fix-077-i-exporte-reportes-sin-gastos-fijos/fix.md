# Fix: El Excel/PDF de Reportes Contables no incluye los gastos fijos
> id: fix-077-i-exporte-reportes-sin-gastos-fijos
> refs: fix-073-i (caso H19 · sospecha S10) · ASG-i-029
> status: done
> closed: 2026-11-15
> created: 2026-11-10
> priority: P1

## Root Cause

`generate-financial-report` no consulta `fixed_expenses`. Confirmado en `fix-073-i` (sede 1,
noviembre 2026): con un Arriendo de $100.000 registrado, la pantalla muestra gastos $155.000 y
neto $1.035.000; el PDF sigue en gastos $55.000 y neto $1.135.000.

Además los nombres de categoría no son los de la pantalla: "combustible" (pantalla "Bencina"),
"Otros" (pantalla "Gastos Varios"), "Servicio Especial" (pantalla "Psicotécnico / Servicios").
`EXPENSE_LABELS` no tiene la clave `combustible`.

## ACs Afectados

- `0003-i` / checklist H19 (exporte = pantalla).
- AC-1: con gastos fijos en el período, el Excel y el PDF suman lo mismo que la pantalla en Total
  Gastos y Neto.
- AC-2: las categorías de ingresos y gastos se llaman igual en la pantalla y en los archivos
  (una sola tabla de nombres compartida).

## Cambio

- **Nuevo `supabase/functions/_shared/financial-report-categories.ts`:** copia espejo de las
  reglas de la pantalla (`reportes-contables.utils.ts` y `payment-status.utils.ts`):
  `expenseCategory()` (alias `combustible` → Bencina, sin categoría → Gastos Varios, desconocida
  → Otros, más las categorías de gastos fijos), `incomeCategory()` (Clase B, Profesional, Cursos
  Singulares, Clases Extra, Psicotécnico / Servicios; con todas las sedes separa por sede),
  `PAYMENT_STATUSES_QUE_SUMAN` (`paid` y `completado`) y `sumFinancialTotals()`.
- **`supabase/functions/generate-financial-report/index.ts`:**
  - consulta `fixed_expenses` del período y la sede, y los suma a los gastos (detalle como
    "Gasto fijo: …");
  - nombres de categoría desde el módulo compartido, en los resúmenes y en el detalle;
  - mismos estados de pago que la pantalla (antes solo `paid`);
  - el día de un cobro de curso singular es el de Chile (`toChileDate`), no el corte UTC del
    instante (un cobro después de las 21:00 caía en el día siguiente).

## Test de Regresión

- `supabase/functions/_shared/financial-report-categories.test.ts` (Deno) ✓ 7/7, incluido el caso
  H19: ingresos $1.190.000, gastos $55.000 + fijo $100.000 → Total Gastos $155.000, Neto
  $1.035.000. Re-corrido tras el deploy (2026-11-13): 7 passed, 0 failed.
- `src/app/core/utils/reportes-contables.utils.spec.ts` (la pantalla; solo se agregó un
  comentario): 57/57 ✓.
- `deno check` de la función: solo el error `Uint8Array` → `Response` que ya existía. `npm run
  lint:arch`: 0 errores, ARCH-27 sin regresiones.
- Base (solo lectura, 2026-11-13): sede 1, noviembre → `expenses` $55.000 + `fixed_expenses`
  $100.000 = $155.000, lo mismo que la pantalla.

## Verificación (2026-11-13, función desplegada con autorización de Ignacio)

Llamada real a `generate-financial-report` con la sesión de `admin@test.com`, sede 1, 01-11 a
30-11-2026:

- **Excel:** Total Ingresos $1.190.000 · Total Gastos **$155.000** · Neto **$1.035.000** (= la
  pantalla, H19). Ingresos: Cursos Singulares $720.000, Clase B $450.000, Psicotécnico /
  Servicios $20.000. Gastos: Arriendo $100.000, Bencina $40.000, Gastos Varios $15.000. Detalle:
  "10-11-2026 | Gasto fijo: QA-073 arriendo noviembre | Arriendo | 100000". AC-1 ✓ AC-2 ✓
- **PDF:** 200 `application/pdf`; contiene $155.000, $1.035.000 y "Arriendo". AC-1 ✓
