# Fix: Reportes Contables — cabecera y chart de Evolución se desbordan en móvil
> id: fix-246-m-reportes-contables-cabecera-movil
> refs: fix-245-m-reportes-contables-scroll-movil (mismo módulo; fix-245 arregló el scroll vertical, esto es el desborde horizontal que no se detectó en su /verify), 0015-m-evolucion-mensual-filtro-propio
> status: done
> closed: 2026-09-09
> created: 2026-09-09

## Root Cause

En `< sm` (móvil) la cabecera del panel de Reportes Contables **se desborda horizontalmente**
y la parte que sobra queda **recortada** por el `overflow-hidden` de `.bento-fill` — no
scrolleable, inalcanzable. Medido en 375px (ancho útil del panel ≈ 247px):

- **`<app-tabs>`** tiene inline `style="width: auto; flex: 0 0 auto"` → el host no se
  contrae; la fila segmentada (≈460px con las 4 pestañas) rebasa el contenedor de 247px.
  "Rentabilidad" y "Gastos Fijos" quedan fuera de pantalla y **no se pueden tocar**. El
  `variant="segmented"` solo hace scroll horizontal o wrap; con el host sin contraer, ni
  scrollea ni envuelve.
- **`<p-select>`** (`styleClass="h-9 min-w-48"`) renderiza ≈413px (su label interno crece a
  373px) → rebasa el contenedor.
- **Fila del chip** (`class="flex items-center gap-2 ml-auto"`) — con `ml-auto` + contenido
  fijo (fecha ≈109px + badge ≈107px) se empuja fuera del borde derecho: **la fecha se corta
  y el badge de margen no se ve**.
- `.bento-fill` tiene `overflow-hidden` (necesario en lg para el clip app-like) que en móvil
  **oculta** el desborde en vez de dejarlo visible o corregible.

Además, el **chart de Evolución Mensual** (`evolucion-mensual-chart`) usa
`.chart-scroll { overflow-x: auto }` + `.mes-col { min-width: 60px }` → en un contenedor
angosto fuerza **scroll horizontal** (incómodo) en lugar de comprimir las columnas para
caber a lo ancho.

fix-245-m corrigió el scroll **vertical** (contenido de abajo ahora alcanzable). Este fix
es el desborde **horizontal**, que se pasó por alto en ese `/verify` por medir solo
geometría de scroll y no mirar la cabecera.

## ACs Afectados

Ninguna spec declaró estos ACs. ACs de regresión que este fix establece:

- **AC-1 — Cabecera usable en móvil (375px):** el selector de rango ocupa el ancho
  disponible sin rebasar; las **4 pestañas son visibles y tocables** (envuelven a 2 líneas
  o scrollean dentro de su propia franja, nunca recortadas por el panel).
- **AC-2 — Fecha y badge visibles:** la fila `DD/MM/YYYY – DD/MM/YYYY` (+ badge de margen
  fuera de la pestaña Evolución) se ve completa; en móvil va en su propia línea, envuelve si
  hace falta, sin `ml-auto` empujándola fuera.
- **AC-3 — Sin recorte horizontal:** ningún elemento del panel rebasa el viewport en 375px;
  `.bento-fill` no recorta contenido en móvil (`overflow-hidden` solo en lg+).
- **AC-4 — Evolución legible en móvil sin scroll horizontal:** en `< lg` el chart pasa a
  **barras horizontales, una fila por mes** (label · barra · monto), scrolleando en vertical
  con la página — 12 meses caben sin encimar montos. En lg+ se conservan las barras
  verticales (con su scroll horizontal interno si 12 no entran).
- **AC-5 — Desktop sin regresión:** en 1280px, cabecera en una fila, pestañas segmentadas en
  línea, chip a la derecha con `ml-auto`, app-like intacto (verificado en 0015-m / fix-245-m).

## Cambio

- **Archivo:** `src/app/shared/components/reportes-contables-content/reportes-contables-content.component.ts`
  - `<app-tabs>`: quitar `style="width: auto; flex: 0 0 auto"`; `class="w-full min-w-0 lg:w-auto lg:flex-none"` + `[wrap]="true"` (envuelve cuando no cabe, línea única cuando sí — sirve en todo breakpoint).
  - `<p-select>`: `styleClass="h-9 min-w-48"` → `styleClass="h-9 w-full sm:w-auto sm:min-w-48"`.
  - Fila del chip: `flex items-center gap-2 ml-auto` → `flex items-center gap-2 flex-wrap w-full lg:w-auto lg:ml-auto`.
  - Fila cabecera: `sm:flex-row sm:items-center` → `lg:flex-row lg:items-center` (queda apilada hasta lg, donde ya hay espacio real).
  - `.bento-fill`: `overflow-hidden` → `lg:overflow-hidden`.
- **Archivo:** `src/app/shared/components/evolucion-mensual-chart/evolucion-mensual-chart.component.ts`
  - Template: **dos layouts** sobre el mismo `barras()` computed —
    `.hrows` (barras horizontales, una `.hrow` por mes: `label · track · valor`) visible en
    `< lg`; el `.chart-scroll` de barras verticales pasa a `display: none` y solo se muestra
    con `@media (min-width: 1024px)`. Comprimir columnas no alcanzaba: 12 barras verticales
    con sus montos arriba se encimaban en 375px.
  - `styles`: `.chart-scroll { display: none }` + `@media (min-width: 1024px) { .chart-scroll
    { display: flex } .hrows { display: none } }`; estilos nuevos `.hrow*` / `.hbar*`.

No cambia contratos públicos (inputs/outputs), lógica, ni BD. Solo layout responsivo — el
`barras()` computed y sus datos no cambian; el layout mobile es DOM adicional, no una rama de
datos.

## Cambio extra (encontrado en `/verify`)

- **Archivo (mismo):** cabecera de la sección "Gastos Fijos del Período" —
  `flex items-center justify-between px-6` (título + botón "Registrar Gasto Fijo" no cabían
  lado a lado en móvil) → `flex flex-col sm:flex-row sm:items-center sm:justify-between
  gap-3 px-4 sm:px-6` + `min-w-0` en el bloque de título.

## Test de Regresión — resultados

- `/verify` (Playwright) **375×812**, probes por pestaña:
  - Categorías / Rentabilidad / Gastos Fijos: `panelOverflowsX=false`, `anyOverflowRight=false`,
    `docScrollsX=false`; las 4 pestañas `tappable=true` (segmented con `[wrap]` a 4 filas);
    selector full-width; fecha `01/09/2026 – 30/09/2026` y badge `99.9% margen` visibles.
    Capturas `verify-246-mobile-{cat,rent,gf-v2}.png`.
  - Evolución: layout `.hrows` activo (`.chart-scroll` `display:none`), 6 y 12 filas
    horizontales (`label · barra · monto`), sin scroll horizontal, montos sin encimar.
    Capturas `verify-246-mobile-evo{6,12}-hbars.png`.
- `/verify` **1280×800**: `.chart-scroll` `display:flex` / `.hrows` `display:none` (barras
  verticales), cabecera en una fila, chip con `lg:ml-auto`, app-like intacto. Sin regresión —
  capturas `verify-246-desktop-{cat,evo-v2}.png`. Consola sin errores.
  > Se detectó y corrigió en el camino un bug de orden de fuente CSS: `@media (min-width:
  > 1024px) { .hrows { display: none } }` colocado ANTES de la regla base `.hrows { display:
  > flex }` no ganaba → ambos layouts se mostraban en desktop. Movido el `@media` al final del
  > bloque `styles`.
- `npm run test:ci` — **2380 passed**. `npm run lint:arch` — 0 errores. `tsc --noEmit` — 0.
