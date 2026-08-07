# Fix: Grids rígidos en Hero Tab fuerzan scroll horizontal en vez de reflow
> id: fix-128-m-hero-tab-fluid-grids
> refs: fix-125-m-hero-tab-studio-controls-container-query
> status: done
> closed: 2026-08-06
> created: 2026-08-06

## Root Cause
El fix-125 corrigió que `.studio-controls` midiera el contenedor real (`@container` en vez de
`@media`), pero eso solo resuelve **cuándo** cambia de 1/2/3 columnas — no resuelve que, dentro de
esas columnas, sigan existiendo grids/flex internos con pistas rígidas que no se encogen por
debajo de su contenido mínimo. El dueño lo confirmó visualmente: con el drawer abierto, la fila
"1. Disposición / Layout de Pantalla" (`.layout-selector-grid`) sigue mostrando scroll horizontal
en vez de adaptarse.

Causa técnica: `grid-template-columns: repeat(3, 1fr)` — el valor `1fr` tiene un mínimo implícito
de `auto` (el ancho de `min-content` del contenido), así que la pista **no se encoge** por debajo
de lo que su contenido pide, aunque haya menos espacio disponible; en vez de reflow, el grid se
desborda y aparece scroll horizontal. Mismo problema, mismo mecanismo, en dos lugares del archivo:

1. `.layout-selector-grid` (las 3 cards de layout: "Centrado" / "Texto Izq / Media Der" /
   "Media Izq / Texto Der") — confirmado en captura del dueño: la 3ra card queda cortada.
2. `.media-type-pills` (los 4 botones "Tema/Color/Imagen/Video" y "Ninguno/Imagen Lateral/Video")
   — mismo patrón (`flex: 1` sin `min-width: 0`), mismo riesgo, no confirmado visualmente pero
   comparte la causa raíz exacta.

## ACs Afectados

- AC-1: `.layout-selector-grid` usa `grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))`
  en vez de `repeat(3, 1fr)` — las 3 cards de layout se reflow a 2 o 1 columna según el ancho real
  disponible, sin necesitar scroll horizontal.
- AC-2: `.media-type-pills` agrega `flex-wrap: wrap` y sus `.media-pill` agregan `min-width: 0` —
  los botones de tipo de fondo/multimedia se reflow a una 2da fila en vez de desbordar.
- AC-3: Con el drawer "Ajustes del Sistema" abierto sobre `/admin/configuracion-web` → tab
  "Sección Hero", ningún elemento requiere scroll horizontal — verificado con Playwright
  (`document`/contenedores relevantes con `scrollWidth <= clientWidth`).
- AC-4: Sin drawer, en 1440×900, el layout se ve igual o mejor que antes (sin regresión visual).

## Cambio
- **Archivo:** `src/app/features/admin/configuracion-web/tabs/hero-tab.component.ts`
  - `.layout-selector-grid`: `grid-template-columns: repeat(3, 1fr)` →
    `repeat(auto-fit, minmax(150px, 1fr))`.
  - `.media-type-pills`: agrega `flex-wrap: wrap`.
  - `.media-pill`: agrega `min-width: 0` (permite que el flex-item se encoja por debajo de su
    contenido si hace falta, en vez de forzar overflow del padre).

## Test de Regresión
`/verify` (Playwright MCP): reproducir el drawer abierto sobre `/admin/configuracion-web` → tab
"Sección Hero", medir `scrollWidth`/`clientWidth` de `.layout-selector-grid` y `.media-type-pills`
(deben ser iguales, sin overflow), captura visual confirmando que las 3 cards de layout y los
pills de tipo de fondo/multimedia se ven completos sin cortes. Confirmar también sin drawer en
1440×900 que no hay regresión visual.

**Ejecutado 2026-08-06 (Playwright MCP):** `npm run lint:arch`: 0 errores. Con el drawer "Ajustes
del Sistema" abierto sobre `/admin/configuracion-web` → tab "Sección Hero": `.layout-selector-grid`
reflow a 1 columna (`scrollWidth === clientWidth`, 284/284), las 3 cards de layout se apilan
verticalmente y se ven completas — captura confirma "Texto Izq / Media Der" totalmente visible sin
recorte. `.media-type-pills` también sin overflow (282/282, `flex-wrap: wrap` confirmado). Sin
drawer, en 1440×900: sin regresión — mismas 3 columnas que antes del fix, captura idéntica al
comportamiento previo. Consola: 0 errores en ambos casos.
