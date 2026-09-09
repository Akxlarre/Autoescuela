# Hotfix: Reportes Contables — fecha + badge de margen al espacio libre arriba-derecha
> id: hotfix-102-m-reportes-cabecera-fecha-arriba-derecha
> refs: fix-246-m-reportes-contables-cabecera-movil
> created: 2026-09-09
> status: done
> closed: 2026-09-09

## Problema

En desktop la cabecera del panel apila: fila 1 = selector, fila 2 = barra de pestañas
(full-width), fila 3 = fecha `DD/MM/YYYY – DD/MM/YYYY` + badge `% margen` alineados a la
derecha. Esa fila 3 desperdicia el espacio libre arriba-derecha (a la altura del selector) y
le roba alto vertical al contenido de cada pestaña — p. ej. la card "Ingresos por Categoría"
queda con scroll interno cuando cabría sin él.

## Cambios

- **Archivo:** `src/app/shared/components/reportes-contables-content/reportes-contables-content.component.ts`
  — cabecera del panel: `position: relative`; el bloque de fecha + badge pasa a
  `lg:absolute lg:top-4 lg:right-4` (esquina superior derecha, a la altura del selector),
  sacándolo del flujo que lo empujaba a una fila propia. En `< lg` se conserva el flujo
  actual (fecha/badge apilados full-width, tras las pestañas — layout aprobado por el owner
  en fix-246-m).
