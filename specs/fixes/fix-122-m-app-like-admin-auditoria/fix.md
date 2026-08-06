# Fix: App-like — `/admin/auditoria`
> id: fix-122-m-app-like-admin-auditoria
> refs: ASG-b-069
> status: in-progress
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

## Checklist de cierre (rollout app-like, heredado de ASG-b-069)

- [ ] `force-compact` verificado con un drawer abierto
- [ ] `/verify` en 390×844, 1440×900 y 768 de alto
- [ ] Confirmar que mover el banner dentro de la card no rompe el export a Excel/PDF

## Cambio
_(a completar durante la implementación)_

## Test de Regresión
_(a completar — `/verify` visual, sin lógica de densidad nueva que testear: el paginador ya
existe y es server-side)_
