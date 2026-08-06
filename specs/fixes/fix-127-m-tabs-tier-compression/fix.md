# Fix: `<app-tabs variant="line">` — compresión adaptativa por tiers en vez de fade+scroll
> id: fix-127-m-tabs-tier-compression
> refs: fix-126-m-tabs-scroll-affordance
> status: done
> closed: 2026-08-06
> created: 2026-08-06

## Root Cause
El fix-126 le agregó a `<app-tabs>` un fade estático (`mask-image`) para "insinuar" que había
más tabs scrolleables cuando el contenedor se angostaba. El dueño lo revisó y lo rechazó: el fade
no elimina el corte real de los labels, aparece incluso **sin** drawer abierto (cuando no hay
overflow real, por ser estático), y "da más sensación de ser un error que una decisión de
diseño". Pidió replicar el patrón ya usado en `libro-de-clases.component.ts` /
`libro-de-clases-subnav.component.ts` (fix-052-m): en vez de depender de scroll horizontal,
comprimir los tabs en tiers (`full` → `short` → `icon` → `select`) según el ancho real del
contenedor, usando el util puro ya existente `core/utils/subnav-tier.utils.ts`
(`pickSubnavTier`), sin reinventar la lógica de selección de tier.

Ese componente resuelve exactamente el mismo problema (fila horizontal de navegación que no
siempre cabe) con:
1. 3 filas de medición ocultas (`full`/`short`/`icon`), cada una `inline-flex` para medir su
   ancho natural real de forma independiente.
2. `ResizeObserver` sobre el host que recalcula el tier vigente en cada resize (incluye el caso
   de un drawer angostando el contenedor).
3. Si ni el tier `icon` cabe, cae a un `<p-select>` (dropdown) en vez de permitir scroll.

## Alcance
Se aplica el patrón **solo a la variante `line`** de `<app-tabs>` (la única que hoy tiene el
problema reportado — es la usada en `/admin/configuracion-web` y en general para navegación de
secciones). Las variantes `segmented` y `pill` no se tocan: se usan típicamente para grupos más
cortos (toggles/filtros), no está reportado el mismo problema en ellas, y agregarles compresión
sin un caso reproducido sería scope no solicitado.

Se remueve por completo el fade (`tabs-scroll-mask`, `mask-image`) agregado en fix-126 — de las 3
variantes, incluidas `segmented`/`pill` (el dueño pidió sacarlo, no lo restringió a `line`).

## ACs Afectados

- AC-1: `TabOption` (`shared/components/tabs/tabs.component.ts`) gana un campo opcional
  `shortLabel?: string` — si no se provee, el tier `short` se comporta igual que `full` para ese
  tab (sin abreviar, ya que no hay dato para abreviar).
- AC-2: La variante `line` mide 3 tiers ocultos (`full`/`short`/`icon`) igual que
  `libro-de-clases-subnav.component.ts`, usa `pickSubnavTier` de `core/utils/subnav-tier.utils.ts`
  para elegir el tier vigente, y reacciona a cambios de ancho del contenedor via `ResizeObserver`.
- AC-3: Si ningún tier (`full`/`short`/`icon`) cabe, la variante `line` cae a un `<p-select>`
  (dropdown) mostrando la tab activa y permitiendo cambiar de tab desde ahí — igual que el
  fallback de `libro-de-clases-subnav`.
- AC-4: `admin-configuracion-web.component.ts` provee `shortLabel` para sus 6 tabs (`General`,
  `Hero`, `Cursos`, `Promo`, `Contacto`, `FAQs`) para que el tier `short` sea útil ahí.
- AC-5: El fade `tabs-scroll-mask`/`mask-image` de fix-126 se elimina completamente de las 3
  variantes.
- AC-6: Con el drawer "Ajustes del Sistema" abierto sobre `/admin/configuracion-web`, los 6 tabs
  caben sin scroll horizontal (tier `short` o `icon` según el ancho disponible) — verificado con
  Playwright reproduciendo el escenario exacto reportado.

## Cambio
- **Archivo:** `src/app/shared/components/tabs/tabs.component.ts`
  - `TabOption`: agrega `shortLabel?: string`.
  - Variante `line`: agrega filas de medición ocultas + `ResizeObserver` + `pickSubnavTier`
    (mismo enfoque que `libro-de-clases-subnav.component.ts`), con fallback a `<p-select>`.
  - Se elimina `tabs-scroll-mask` de las 3 variantes y su CSS (`mask-image`).
- **Archivo:** `src/app/features/admin/configuracion-web/admin-configuracion-web.component.ts`
  - Agrega `shortLabel` a las 6 entradas de `tabs` (General, Hero, Cursos, Promo, Contacto, FAQs).

## Test de Regresión
El util `pickSubnavTier` ya tiene su `.spec.ts` (fix-052-m) — no se duplica. Para la lógica nueva
de medición/ResizeObserver dentro de `TabsComponent` (decisión: qué tier mostrar), se sigue el
mismo criterio que `libro-de-clases-subnav.component.spec.ts` si aplica reutilizar ese patrón de
test; si el componente sigue siendo mayormente wiring de DOM (difícil de testear en jsdom sin
layout real), se valida con `/verify` (Playwright, mide anchos reales en navegador real) en vez de
duplicar mocks de `ResizeObserver`. `/verify`: reproducir drawer abierto sobre
`/admin/configuracion-web`, confirmar que los 6 tabs son legibles (algún tier `short`/`icon`) sin
scroll horizontal necesario, y confirmar que el fade ya no aparece en ningún caso.

**Ejecutado 2026-08-06 (Playwright MCP):** `npm run lint:arch`: 0 errores (1 warning nuevo de
`ARCH-09` "clase demasiado grande" en `tabs.component.ts`, 298 líneas — no bloqueante, mismo tipo
de warning preexistente en otros shared components). Sin drawer (1440×900): tier `full`, 6 tabs
completos, sin fade fantasma. Con el drawer "Ajustes del Sistema" abierto (`<main>` a 390px):
colapsó a tier `icon` — `tablist.scrollWidth === tablist.clientWidth` (390/390), sin overflow,
6 tabs visibles solo con ícono, sin necesidad de scroll. En un ancho intermedio (900px viewport,
sin drawer): tier `short` — "GENERAL/HERO/CURSOS/PROMO/CONTACTO/FAQS" legibles y completos. Click
en un tab (tier `short`) navega correctamente a su contenido. Verificado en modo oscuro: contraste
correcto. Consola: 0 errores en todos los casos.
