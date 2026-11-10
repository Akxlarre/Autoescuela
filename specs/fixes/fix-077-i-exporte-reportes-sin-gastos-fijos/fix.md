# Fix: El Excel/PDF de Reportes Contables no incluye los gastos fijos
> id: fix-077-i-exporte-reportes-sin-gastos-fijos
> refs: fix-073-i (caso H19 · sospecha S10) · ASG-i-029
> status: in_progress
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

- **Archivo:** `supabase/functions/generate-financial-report/index.ts`.
- **Qué cambia:** suma `fixed_expenses` del período y sede; usa los mismos nombres de categoría
  que `reportes-contables.utils.ts`.

## Test de Regresión

- Test de la edge function con un gasto fijo en el período: Total Gastos y Neto = pantalla.
