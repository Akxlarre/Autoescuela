# Fix: Exportar auditoría trae solo 1.000 filas sin avisar
> id: fix-488-m-exportar-auditoria-truncada
> refs: ASG-i-036
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Root Cause

`generate-audit-report` pedía `audit_log` en una sola consulta con `.limit(5000)`, pero PostgREST
corta en `max_rows = 1000` sin error (DG-008). Exportar "Todas las sedes" sin filtros entregó
1.000 filas de 78.000 registros, y el archivo decía "Total registros: 1000" como si fuera todo
(caso G06 / S13 de `fix-485-m`).

## ACs Afectados

- Ninguno de spec — hallazgo G06/S13 del testing `fix-485-m`.

## Cambio

- **`supabase/functions/_shared/paged-fetch.ts` (nuevo):** `fetchPagesCapped()` pide páginas de
  1.000 hasta agotar o llegar a un tope, y devuelve las filas y si quedó corto.
- **`generate-audit-report`:** usa ese helper con tope de 10.000 filas en Excel y 2.000 en PDF (dibujarlo cuesta CPU en la función), y el total exacto. Si el
  período tiene más, el Excel y el PDF dicen "Se exportaron los 10.000 más recientes de N" y la
  respuesta Excel trae `truncated` y `total`.
- **`core/facades/auditoria.facade.ts`:** si la exportación quedó corta, un toast de advertencia
  pide acotar el período.

## Test de Regresión

- `supabase/functions/_shared/paged-fetch.test.ts` (deno test) ✓
- `core/facades/auditoria.facade.spec.ts > fix-488-m` ✓
