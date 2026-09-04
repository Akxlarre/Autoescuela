# Hotfix: Reordenar KPIs de Servicios Especiales + KPI de recaudación del mes

> id: hotfix-099-m-servicios-especiales-kpis-reorden-recaudacion-mes
> status: done
> closed: 2026-09-04
> created: 2026-09-04

## Qué

Feedback visual del dueño sobre el Hero de Servicios Especiales:
1. "Ventas del mes" y "Ventas Totales" deben ir uno al lado del otro (agrupar conteos).
2. "Pend. de cobro" se reemplaza por "Recaudación del mes" (dato más accionable día a día
   que la deuda pendiente, que ya es marginal desde que toda venta se cobra al registrarse,
   fix-025-i).
3. "Total recaudado" se renombra a "Recaudación Total" (para diferenciarlo claramente del
   nuevo "Recaudación del mes").

Orden final de los 4 KPIs: Ventas del mes, Ventas Totales, Recaudación del mes, Recaudación Total.

## Cambio

- `core/models/ui/servicios-especiales.model.ts`: agrega `recaudacionMes: number` a
  `ServiciosEspecialesKpis`.
- `core/facades/servicios-especiales.facade.ts`: el `computed(kpis)` calcula `recaudacionMes`
  (suma de `precio` de ventas cobradas del mes actual, mismo criterio que `ventasMes` para el
  filtro de mes y que `totalCobrado` para el filtro de cobrado).
- `servicios-especiales-content.component.ts`: reordena `heroKpis` y renombra labels según lo
  de arriba. `pendientesCobro`/`ventasSinCobrar` dejan de usarse en el Hero (el campo sigue
  existiendo en el modelo/facade — no se toca lógica de negocio, solo qué se muestra).

## Por qué es hotfix y no fix

Cambio puramente de presentación + un campo derivado adicional en un `computed()` ya existente,
sin decisiones de diseño nuevas ni contratos públicos afectados fuera de este componente/facade.
