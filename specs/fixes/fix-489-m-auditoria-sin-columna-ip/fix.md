# Fix: Auditoría — quitar la columna IP, que nunca tuvo datos
> id: fix-489-m-auditoria-sin-columna-ip
> refs: ASG-i-036
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Root Cause

`log_change()` nunca llena `audit_log.ip`, así que la columna IP de la tabla, el campo IP del
drawer y la columna IP del Excel/PDF mostraban siempre "—" (S12 / B05 de `fix-485-m`). Además
la columna ocupaba 120 px y a 1440 px quedaba fuera de la pantalla. Detrás de Supabase la IP no
es confiable, y la decisión D2 de `fix-485-m` fue quitarla, no empezar a registrarla.

## ACs Afectados

- Ninguno de spec — hallazgo S12/B05 del testing `fix-485-m` (decisión D2).

## Cambio

- **`core/models/ui/audit-log-row.model.ts` y `core/facades/auditoria.facade.ts`:** la fila ya no
  trae `ip`.
- **`features/admin/auditoria/*`:** sin columna IP en la tabla ni campo IP en el drawer; la grilla
  pierde esa columna.
- **`generate-audit-report`:** sin columna IP en Excel ni PDF (el detalle del PDF usa ese ancho).
- La columna `audit_log.ip` queda en la BD (sin migración).

## Test de Regresión

- `core/facades/auditoria.facade.spec.ts > fix-489-m` ✓
