# Fix: Reportes Contables se ve cortado en móvil (app-like no revierte a scroll nativo)
> id: fix-245-m-reportes-contables-scroll-movil
> refs: 0015-m-evolucion-mensual-filtro-propio (detectado en su /verify), 0003-i-app-like-reportes-contables
> status: done
> closed: 2026-09-09
> created: 2026-09-09

## Root Cause

En `< lg` (móvil/tablet) la página **Reportes Contables** recorta el contenido en vez de
dejar que la página scrollee. Pasa en **las 4 pestañas** (Categorías, Evolución Mensual,
Rentabilidad, Gastos Fijos), no es de 0015-m — es preexistente.

El SCSS canónico (`src/styles/layout/_bento-grid.scss`) **ya es correcto para móvil**:
`bento-grid--fill-screen` solo fija `height: calc(100vh - 120px)` + `grid-template-rows` y
el `contain: size` / `min-height: 0` de `.bento-fill` **dentro de
`@container layoutmain (min-width: lg)`**. Bajo `lg` el grid fluye natural.

Lo que recorta son **clases del template de `reportes-contables-content.component.ts` que
son incondicionales** y pelean contra ese canon:

- `.bento-fill … h-full` en la celda protagonista → `height: 100%` aunque el grid no tenga
  altura fija en móvil.
- `flex-1 min-h-0` (+ `overflow-y-auto` / `overflow-auto` internos) en el wrapper de
  contenido y en cada `@case` de pestaña → el panel se clampa a una altura derivada del
  viewport y hace **scroll interno anidado** (el "cortado" que se ve) en lugar de crecer y
  dejar scrollear el documento.

Categorías ya usa prefijos `lg:` en su interior (líneas ~298–306), pero el `h-full` de la
celda `.bento-fill` la vuelve a clampar igual.

## ACs Afectados

Ninguna spec declaró un AC de scroll móvil de esta página. ACs de regresión que este fix
establece:

- **AC-1 — Móvil (< lg) scrollea la página:** en 375×812, en cualquiera de las 4 pestañas,
  el contenido completo es alcanzable con scroll nativo del documento; no hay recorte ni
  scrollbar anidado dentro del panel.
- **AC-2 — Desktop (lg+) sin regresión:** el contrato app-like sigue igual — el documento
  NO scrollea, la celda `.bento-fill` llena el alto y scrollea internamente, las columnas de
  Categorías/Rentabilidad tienen su scroll propio. (Ya verificado en 0015-m.)
- **AC-3 — Evolución Mensual:** el gráfico mantiene su scroll horizontal interno en 12 meses
  en ambos breakpoints; en móvil la página scrollea vertical y el chart scrollea horizontal.

## Cambio

- **Archivo:** `src/app/shared/components/reportes-contables-content/reportes-contables-content.component.ts`
- **Qué cambia:** prefijar con `lg:` los clamps de altura/overflow para que coincidan con el
  breakpoint que ya usa el SCSS (`@container layoutmain (min-width: lg)`):
  - celda `.bento-fill`: `h-full` → `lg:h-full`
  - wrapper de contenido y cada `@case`: `flex-1 min-h-0` → `lg:flex-1 lg:min-h-0`
  - scrolls internos: `overflow-y-auto` / `overflow-auto` → `lg:overflow-y-auto` / `lg:overflow-auto`
  - `class="flex-1 min-h-0"` que se pasa a `<app-evolucion-mensual-chart>` /
    `<app-rentabilidad-cursos>` → `lg:flex-1 lg:min-h-0`
- **Archivo (si algún hijo sigue cortando en móvil tras lo anterior):**
  `evolucion-mensual-chart.component.ts` / `rentabilidad-cursos.component.ts` — relajar el
  `:host { height: 100% }` a `auto` bajo `lg` (media/container query), conservando su
  `min-height` de fallback.

No cambia contratos públicos (inputs/outputs), ni el comportamiento desktop, ni BD.

## Cambio (implementado)

Solo `reportes-contables-content.component.ts`, prefijando `lg:` los clamps:
- celda `.bento-fill`: `h-full` → `lg:h-full`
- wrapper de contenido + los 3 `@case` (`evolucion`/`rentabilidad`/`gastos-fijos`):
  `flex-1 min-h-0 flex flex-col` → `lg:flex-1 lg:min-h-0 flex flex-col`
- wrapper de Categorías: `flex-1 min-h-0 overflow-y-auto lg:overflow-visible` →
  `lg:flex-1 lg:min-h-0 lg:overflow-visible`
- tabla de Gastos Fijos: `flex-1 min-h-0 overflow-auto` →
  `lg:flex-1 lg:min-h-0 overflow-x-auto lg:overflow-auto` (mantiene scroll horizontal de la
  tabla en móvil)
- `class` pasada a `<app-evolucion-mensual-chart>` y `<app-rentabilidad-cursos>`:
  `flex-1 min-h-0` → `lg:flex-1 lg:min-h-0`

No hizo falta tocar los componentes hijos.

## Test de Regresión — resultados

- `/verify` (Playwright) **375×812**, las 4 pestañas: `.bento-fill` crece con su contenido
  (Categorías 964px, Gastos Fijos 660px, Rentabilidad 1100px — todos > viewport), el
  scroller `.shell-content` del shell lo revela completo, **0 scrollers verticales anidados**
  dentro del panel. Confirmado con capturas (`verify-245-mobile-*.png`).
- `/verify` **1280×800** — sin regresión app-like: `.shell-content` NO scrollea,
  `.bento-grid--fill-screen` = `calc(100vh - 120px)` (680px), `.bento-fill` con
  `contain: size`; Evolución (6m + "Sin movimientos" + dashed baseline) y Categorías (listas
  con scroll propio, Total anclado) idénticas a antes. Consola sin errores.
- `npm run test:ci` — **2380 passed** (sin cambios).
- `npm run lint:arch` — 0 errores.

## Nota

El "scroll de la página" en este shell es el contenedor `.shell-content` (`overflow-y: auto`),
no `document` — `body` está pineado a `h-dvh`. El fix logra que en `< lg` el contenido crezca y
ese scroller lo alcance, que es el comportamiento esperado en móvil.
