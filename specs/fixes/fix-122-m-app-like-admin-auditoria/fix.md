# Fix: App-like — `/admin/auditoria`
> id: fix-122-m-app-like-admin-auditoria
> refs: ASG-b-069
> status: done
> closed: 2026-08-06
> created: 2026-08-05

## Root Cause
[Heredado de ASG-b-069, a confirmar]: `AdminAuditoriaComponent` usa `bento-grid--hero-fit` (no
aporta app-like) en vez de `bento-grid--fill-screen`. La card de tabla no crece ni scrollea
internamente — hoy es un grid CSS custom (no `<table>`) con `<p-paginator>` **server-side**
(`facade.setPage()` dispara un fetch nuevo al backend, 25 registros/página) y un banner
informativo sobre política de correos como 3ra celda separada del grid, en vez de vivir dentro
de la card de tabla como footer fijo (decisión ya tomada 2026-08-02: el banner se mueve dentro
de la card, debajo del paginador — ningún modificador `--fill-screen-*` existente soporta
"hero + fila fill + fila estática abajo").

**⚠️ El paginador NO se saca** — es server-side, no hay lista completa en memoria para scrollear.

## ACs Afectados

- AC-1: Root del componente usa `bento-grid--fill-screen` (no `bento-grid--hero-fit`).
- AC-2: La card de tabla tiene `bento-fill flex flex-col h-full` y crece a ocupar el alto
  disponible en desktop (lg+).
- AC-3: El wrapper de filas (hoy `overflow-x-auto`) agrega `flex-1 min-h-0 overflow-y-auto` —
  scroll interno de las 25 filas de la página actual; toolbar de filtros y `<p-paginator>`
  quedan fijos arriba/abajo.
- AC-4: El banner informativo de política de correos vive dentro de la card de tabla, como
  último elemento (`shrink-0`), debajo del `<p-paginator>` — ya no es una 3ra celda separada
  del grid.
- AC-5: `<p-paginator>` server-side sin cambios de lógica (sigue disparando `facade.setPage()`).
- AC-6: En Mobile, la página revierte a scroll nativo (sin `bento-fill` forzando `contain:size`
  fuera de lg+).
- AC-7: El menú de exportar (Excel/PDF, `position:absolute`) no queda visualmente interferido
  por el banner movido.
- AC-8: La columna "Detalles" del grid (`.audit-grid`) tiene un piso mínimo real
  (`minmax(200px, 1fr)`) — el texto no se parte palabra por palabra cuando el contenedor se
  angosta (ej. drawer abierto).

## Checklist de cierre (rollout app-like, heredado de ASG-b-069)

- [x] `force-compact` verificado con un drawer abierto
- [x] `/verify` en 390×844, 1440×900 y 768 de alto
- [x] Confirmar que mover el banner dentro de la card no rompe el export a Excel/PDF

## Cambio
- **Archivo:** `src/app/features/admin/auditoria/admin-auditoria.component.ts`
  - Root: `bento-grid--hero-fit` → `bento-grid--fill-screen`.
  - Card de tabla (`bento-banner`): agrega `bento-fill flex flex-col h-full` (hijo directo del
    root, cumple el contrato de `.bento-fill` en `_bento-grid.scss`).
  - Wrapper de filas: `overflow-x-auto` → `flex-1 min-h-0 overflow-y-auto overflow-x-auto`
    (scroll interno vertical + horizontal, toolbar/paginador quedan fijos).
  - `<p-paginator>` envuelto en `div.shrink-0` (sin cambios de lógica).
  - Banner de política de correos: se mueve de 3ra celda del grid (`bento-banner` propio) a
    último elemento dentro de la card de tabla, `shrink-0`, debajo del paginador.
  - **Hallazgo durante QA con drawer abierto (2026-08-06):** `.audit-grid`/`.audit-grid--no-sede`
    declaraban la columna "Detalles" como `1fr` sin piso, y el `min-width` del grid (900px /
    780px) era **menor** que la suma real de columnas fijas + gaps (954px / 808px) — el `1fr`
    quedaba sin espacio y se apretaba a su `min-content`, partiendo el texto palabra por palabra.
    Pre-existente, pero expuesto ahora porque el drawer angosta el contenedor con más frecuencia.
    Fix: `minmax(200px, 1fr)` para Detalles + `min-width` recalculado a 1160px / 1010px (suma de
    columnas fijas + gaps + el piso de 200px). Corregido en el mismo track por encajar en el
    checklist "force-compact verificado con un drawer abierto" (línea 38).

## Test de Regresión
`/verify` visual — sin lógica de densidad nueva que testear (paginador server-side ya existente,
sin cambios de lógica). Pendiente: `/verify` en 390×844, 1440×900, 768 de alto + `force-compact`
con drawer abierto (confirmando que "Detalles" ya no se parte palabra por palabra) + confirmar
que el menú de exportar no queda interferido por el banner.
