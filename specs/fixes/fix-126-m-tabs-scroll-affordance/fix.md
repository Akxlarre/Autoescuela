# Fix: `<app-tabs>` sin affordance visual de scroll cuando el contenedor angosta
> id: fix-126-m-tabs-scroll-affordance
> refs: fix-124-m-app-like-configuracion-web
> status: done
> closed: 2026-08-06
> created: 2026-08-06

## Root Cause
`shared/components/tabs/tabs.component.ts` — las 3 variantes (`line`, `segmented`, `pill`) ya
tienen `overflow-x-auto` en su contenedor `role="tablist"`, así que **técnicamente scrollean**
cuando no caben todos los tabs. Pero también tienen `scrollbar-width: none` /
`::-webkit-scrollbar { display: none }` (`.custom-scrollbar-hidden`), así que no hay **ninguna**
señal visual de que hay más tabs fuera de vista — el usuario ve la lista "cortada" sin saber que
puede scrollear.

Hallado durante QA visual de fix-124: con un drawer abierto angostando `<main>`, los tabs de
"CAMPAÑA PROMO" en adelante quedan visualmente recortados al borde de la card, sin ninguna pista
de que son alcanzables con scroll horizontal. Reproducido con Playwright: `tablist.scrollWidth`
(720px) > `tablist.clientWidth` (390px), `overflow-x: auto` confirmado — es scrolleable pero
invisible.

Afecta a **todas** las páginas que usan `<app-tabs>` con cualquiera de las 3 variantes, no solo
`/admin/configuracion-web` — por eso va en un track separado de fix-124/fix-125.

**Patrón ya establecido en el repo** (no se inventa nada nuevo): fade estático con `mask-image`
en el borde de scroll, sin detección de overflow por JS —
- `dashboard.component.ts` (`.scroll-fade::after`) — fade vertical inferior con gradiente de color.
- `admin-configuracion-web.component.ts` (`.category-scroll-container`) — fade horizontal derecho
  con `mask-image: linear-gradient(to right, black 85%, transparent 100%)`.

Se reutiliza la técnica de `.category-scroll-container` (mask-image, no pseudo-elemento de color)
porque `<app-tabs>` es genérico y se usa sobre fondos distintos según la página — un overlay de
color fijo (como `.scroll-fade`) asumiría un `background` que no siempre es correcto; `mask-image`
desvanece la opacidad del contenido real sin pintar ningún color, así que funciona igual sobre
cualquier fondo.

## ACs Afectados

- AC-1: Las 3 variantes (`line`, `segmented`, `pill`) de `<app-tabs>` tienen un fade visual en el
  borde derecho de su contenedor scrolleable (`mask-image`, mismo valor que
  `.category-scroll-container`: `linear-gradient(to right, black 85%, transparent 100%)`).
- AC-2: El fade es puramente decorativo (`mask-image` en CSS, sin JS/signals nuevos) — no bloquea
  clicks ni cambia el comportamiento de scroll existente.
- AC-3: Reproducir el escenario de fix-124/fix-125 (drawer abierto angostando `<main>` en
  `/admin/configuracion-web`) y confirmar que ahora el usuario tiene una señal visual de que hay
  más tabs a la derecha.

## Cambio
- **Archivo:** `src/app/shared/components/tabs/tabs.component.ts`
  - Se agrega la clase `tabs-scroll-mask` (o similar) a los 3 `<div role="tablist">` junto a
    `overflow-x-auto custom-scrollbar-hidden`.
  - Se agrega el estilo `mask-image`/`-webkit-mask-image` (mismo gradiente que
    `.category-scroll-container`) al bloque `styles` del componente.

## Test de Regresión
Sin lógica nueva (CSS puro, sin `computed()`/signals) — no requiere `.spec.ts` nuevo per
`testing-tdd.md` ("Dumb sin lógica → opcional"). `/verify` visual: reproducir el drawer abierto
sobre `/admin/configuracion-web` y confirmar el fade en los tabs con `lint:arch` en 0 errores.

**Ejecutado 2026-08-06 (Playwright MCP):** `npm run lint:arch`: 0 errores. Con el drawer "Ajustes
del Sistema" abierto sobre `/admin/configuracion-web`, `getComputedStyle(tablist).maskImage`
confirma `linear-gradient(to right, rgb(0,0,0) 85%, rgba(0,0,0,0) 100%)` aplicado — captura
confirma el fade visual en "CURSOS & PRECIOS" (borde derecho recortado por el drawer). Sin drawer
(6 tabs caben completos, `scrollWidth === clientWidth`, sin overflow real), el último tab
("PREGUNTAS FAQS") recibe un leve desvanecimiento cosmético por ser el mask estático (no detecta
overflow real) — mismo trade-off ya aceptado en `.category-scroll-container`, texto sigue
legible. Verificado también en modo oscuro: contraste correcto, sin regresiones. Consola: 0
errores.
