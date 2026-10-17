# Fix: El export del Historial de ventas no coincide con la pantalla
> id: fix-440-m-export-ventas-igual-a-pantalla
> refs: fix-429-m-testing-servicios-especiales (S10, casos K02, K04–K07) · fix-147-b · fix-025-i
> status: done
> closed: 2026-10-15
> created: 2026-10-15

## Root Cause

`export-special-services` exporta todas las ventas de la sede, sin mirar lo que el usuario está
viendo: ignora el filtro de servicio, el período y (desde `fix-439-m`) la búsqueda. `fix-147-b` lo
hizo a propósito ("el export es inmune a los filtros de la vista"); la decisión K04 lo revierte. Además
usa el nombre **actual** del catálogo (`service_catalog.name`), así que una venta de un servicio
renombrado sale con el nombre nuevo y una de un servicio eliminado sale sin servicio; no trae N° de
boleta ni medio de pago; conserva "Estado"/"Pagado" (columnas que la UI quitó en `fix-025-i`) y el
PDF no tiene sede ni total.

**Decisión de Matías (2026-10-15, K04/K07):** el export respeta el filtro de servicio y el período,
usa el nombre guardado en la venta, agrega N° de boleta, medio de pago y total, y quita
Estado/Pagado.

## ACs Afectados

- `fix-147-b` — su AC ("el export no recibe nada de la vista") queda reemplazado por esta decisión.

ACs propios:

- AC-1: el archivo (Excel y PDF) trae exactamente las ventas que muestra el Historial con sus
  filtros (servicio, período y búsqueda), y su cantidad coincide con el contador "N de M ventas".
- AC-2: columnas Fecha, Cliente, RUT, Servicio (nombre guardado en la venta), N° boleta, Medio de
  pago, Monto, Sede, y una fila de total. Sin Estado ni Pagado.
- AC-3: la función sigue acotando a la sede de quien llama (`fix-430-m`): un id de otra sede no sale.
- AC-4: sin ventas visibles, el botón avisa "No hay ventas para exportar" y no llama a la función.

## Cambio

- `supabase/functions/export-special-services/rows.ts` (nuevo, núcleo puro) — columnas, filas,
  total y validación de los ids.
- `supabase/functions/export-special-services/index.ts` — recibe `sale_ids`; Excel y PDF con las
  columnas nuevas y total.
- `core/facades/servicios-especiales.facade.ts` — `exportarHistorial(format, ventaIds)`.
- `features/admin/servicios-especiales/historial-ventas-drawer.component.ts` — exporta los ids de
  `ventasFiltradas()`.

## Test de Regresión

- `supabase/functions/export-special-services/rows.test.ts`.
- `servicios-especiales.facade.spec.ts > exportarHistorial — exporta lo que muestra la pantalla (fix-440-m)`.
- `historial-ventas-drawer.component.spec.ts > exporta los ids de la lista filtrada`.
- Desplegada por Matías el 2026-10-15; Excel y PDF verificados en navegador ✅.
