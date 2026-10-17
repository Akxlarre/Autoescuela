# Fix: Una venta de servicio especial se borra sin dejar rastro
> id: fix-443-m-anular-venta-servicio-en-vez-de-borrar
> refs: fix-429-m-testing-servicios-especiales · fix-437-m · fix-432-m · spec 0025-m
> status: done
> closed: 2026-10-16
> created: 2026-10-16

## Root Cause

"Borrar venta" (Historial) y "Eliminar ingreso" (Caja, desde `fix-437-m`) hacen un DELETE de
`special_service_sales`: la venta desaparece del Historial, de la Caja y de los reportes, y solo queda
la fila del `audit_log`, que nadie revisa en el día a día. La secretaria puede vender en efectivo,
borrar la venta antes del cierre y la caja cuadra igual; una venta con boleta emitida pierde su
respaldo en el sistema. Los pagos de matrícula ya no se borran: se anulan con motivo (spec 0025-m).

**Decisión de Matías (2026-10-16):** las ventas se anulan como los pagos, y **solo el admin** anula.

## ACs Afectados

- `fix-437-m` AC-1 y el borrado de `fix-022-i`/`ASG-b-050`: "borrar" pasa a "anular".

ACs propios:

- AC-1: el admin anula una venta desde el Historial o desde la Caja con un motivo obligatorio; la
  venta queda con estado anulado, motivo, quién y cuándo (los fija la BD).
- AC-2: una venta anulada no suma en los KPIs del módulo, la Caja, Reportes Contables, el reporte
  financiero ni el Dashboard; sigue visible tachada, con el motivo, en el Historial, la Caja, la
  ficha del alumno y el export (marcada como anulada y fuera del total).
- AC-3: la secretaria no ve la acción de anular, y la BD le rechaza la anulación.
- AC-4: nadie puede borrar una venta (sin policy de DELETE); una anulada no se puede "desanular" ni
  modificar (salvo desvincular el servicio al eliminarlo del catálogo, `fix-024-i`).
- AC-5: no se anula una venta de un día con caja cerrada (`fix-432-m`/`fix-444-m`).

## Cambio

- `supabase/migrations/20261016130000_fix443_anular_venta_servicio.sql` — columnas
  `voided_at`/`voided_by`/`void_reason`; trigger `guard_anulacion_venta_servicio`; sin DELETE;
  `servicios_especiales_kpis()` excluye anuladas.
- `core/facades/servicios-especiales.facade.ts` — `anularVenta(id, motivo)` reemplaza a
  `borrarVenta()`; `puedeAnular`; las ventas traen su anulación.
- `features/admin/servicios-especiales/historial-ventas-drawer.component.ts` — "Anular" con motivo
  (solo admin); fila anulada tachada con el detalle.
- `core/facades/cuadratura.facade.ts` + `shared/components/cuadratura-content` + Smart de Caja
  (admin) — la Caja trae las ventas anuladas tachadas; "Anular venta" con motivo, solo admin.
- `core/facades/admin-alumno-detalle.facade.ts` — la venta anulada se ve tachada en la ficha.
- `supabase/functions/export-special-services` — la anulada sale marcada y fuera del total.
- `core/utils/anulacion-pago.utils.ts` — `ingresoSeAnula()`/`etiquetaAnularIngreso()`: una sola
  regla de qué ingreso de la Caja se anula (pago y venta) y cuál se revierte (curso singular).
- Dashboard, Reportes Contables y `generate-financial-report` no se tocan: ya suman solo
  `paid = true`, y el trigger deja la venta anulada con `paid = false`.

## Progreso

- [x] Código de app, edge function y tests unitarios (`test:ci` 4298 verdes, deno 6/6) — 2026-10-16
- [x] Matías aplica `20261016130000_fix443_anular_venta_servicio.sql` — 2026-10-16
- [x] `supabase/tests/servicios/fix-443-m-anular-venta-servicio.sql` contra dev: 8/8 ok
- [x] `/verify`: Historial y Caja (admin anula con motivo; tachada, fuera de KPIs y totales),
  secretaria (ve anuladas, sin botón), ficha del alumno (tachada, "Anulado"). Consola y red limpias.
  Ventas de prueba 672 y 673 (sede 1, 16-10-2026) quedan anuladas en dev.
- [x] Tooltip "Anular venta"/"Anular pago" en el botón (pedido de Matías al verificar); título del
  modal de Caja dice "Anular venta #id".
- [x] Matías despliega `export-special-services`; re-probado con la secretaria: Excel con columna
  Anulación y total $0, PDF con montos entre paréntesis y "Total (0 ventas) $0"
- [ ] `/fix-close` y commit

## Test de Regresión

- `supabase/tests/servicios/fix-443-m-anular-venta-servicio.sql` (transacción revertida).
- `servicios-especiales.facade.spec.ts > anularVenta (fix-443-m)`.
- `cuadratura.facade.spec.ts > fix-443-m`.
- `historial-ventas-drawer.component.spec.ts > fix-443-m`.
- `export-special-services/rows.test.ts > anulada`.
