# Hotfix: Tabs de DMS desalineadas 8px respecto al hero/panel (px-2 sobrante)
> id: hotfix-046-b-dms-tabs-px2-desalineado
> status: done
> closed: 2026-08-10
> created: 2026-08-10

## Problema

En `DmsListContentComponent`, el `<div class="bento-banner px-2">` que envuelve `<app-tabs>`
tiene un `px-2` (8px por lado) que ninguna otra fila del grid tiene. Medido en vivo (DOM real):
las 3 filas (hero / tabs / panel) están alineadas a `left:36px` como contenedores, pero el
`px-2` insetea el contenido visible de las tabs a `left:44px`, mientras el hero y el panel
(`.bento-card`) arrancan en `36px` — 8px de desalineación visual. Como es un offset fijo (no
escala con el padding del grid, que sí se achica en breakpoints angostos vía
`var(--bento-pad-sm/md/lg)`), se nota proporcionalmente más en pantallas chicas o cuando un
drawer aprieta `<main>` — confirmado por el owner viéndolo en vivo.

## Cambios

- **Archivo:** `src/app/shared/components/dms-list-content/dms-list-content.component.ts`
  - `<div class="bento-banner px-2"><app-tabs .../></div>` → `<app-tabs class="bento-banner"
    .../>` (sin wrapper div ni `px-2`; `TabsComponent` ya tiene `:host { display: block; width:
    100% }`, puede llevar la clase de fila directamente).
