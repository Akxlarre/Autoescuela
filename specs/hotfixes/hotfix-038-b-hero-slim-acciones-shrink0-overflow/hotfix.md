# Hotfix: Botón de acciones del hero slim se corta en viewports intermedios (~900-1000px)
> id: hotfix-038-b-hero-slim-acciones-shrink0-overflow
> status: in_progress
> created: 2026-08-08

## Problema

En `SectionHeroComponent` modo `slim`, la fila raíz (`sm:flex-row sm:flex-wrap`) sí envía el
bloque de acciones (chips + botones) a su propia línea cuando el título no tiene espacio — pero
ese bloque tiene `shrink-0`, así que en su línea propia toma su ancho natural completo (ej: 898px)
en vez de encogerse al ancho disponible de la fila (ej: 814px). El wrapper ancestro tiene
`overflow-hidden`, así que el sobrante se recorta visualmente en vez de que los botones internos
hagan su propio wrap (que ya tienen habilitado con `flex-wrap`, pero nunca se activa porque el
contenedor nunca llega a ser más angosto que su contenido).

Reproducido en `/app/admin/dashboard` a 910px de ancho de viewport (sin drawer abierto — no es
`force-compact`): "Registrar Egreso" queda cortado a la mitad. Confirmado con
`getBoundingClientRect()`: el contenedor de acciones mide 898.6px de ancho dentro de una fila de
814px disponibles.

Ya existe el fix correcto para este mismo problema, pero solo aplicado condicionalmente dentro de
`:host-context(.force-compact)` (cuando el layout-drawer está abierto) — ver
`section-hero.component.ts` (bloque `[role='group']`/contenedor RIGHT en el CSS de compact mode).
Falta aplicarlo también como comportamiento por defecto, no solo en compact.

## Cambios

- **Archivo:** `src/app/shared/components/section-hero/section-hero.component.ts` — en el template
  modo slim, el contenedor RIGHT (`<div class="flex items-center gap-2 flex-wrap shrink-0">`,
  línea ~471) cambia `shrink-0` → `shrink min-w-0`, para que al quedar solo en su propia línea se
  ajuste al ancho disponible de la fila y su `flex-wrap` interno (chips/acciones) se active en vez
  de desbordar y ser recortado por el `overflow-hidden` del wrapper ancestro.
