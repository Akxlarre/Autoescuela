# Fix: contabilidad/cursos — switch mobile/desktop por contenedor + color de separadores

> id: fix-136-b-cursos-container-query-divide-color
> refs: —
> status: done
> closed: 2026-08-11
> created: 2026-08-11

## Root Cause

QA visual del usuario sobre `/admin/contabilidad/cursos` (post fix-133-b) encontró 2 problemas
reales:

1. **El drawer no cambia la vista a cards.** El switch mobile/desktop usa breakpoints de
   **viewport** de Tailwind (`lg:hidden` / `hidden lg:block`) en vez de `@container` — la
   trampa "switch por contenedor, NO por `lg:`" que `visual-system.md` ya documenta
   explícitamente. Al abrir un drawer se angosta `<main>`, no el viewport del navegador, así
   que Tailwind nunca dispara el cambio — la tabla se queda con scroll horizontal. Es la
   misma página que ya migré a `--fill-screen` en `fix-133-b`, pero ese fix tocó el layout de
   fill/scroll, no el mecanismo de switch mobile/desktop (que ya estaba mal desde antes).
2. **Separadores negros en vez de grises.** `divide-x`/`divide-y` sin sufijo de color caen a
   `currentColor` en Tailwind v4 (no al token de borde) — confirmado en vivo:
   `getComputedStyle().borderLeftColor` da `rgb(9, 9, 11)` (negro pleno), no la rgba semitransparente
   de `--border-subtle`/`--border-muted`. `src/tailwind.css:57` ("Fix: default color for
   'border' class") **no arregla esto** — solo registra `--color-border` como color nombrado
   disponible (habilita la clase `border-border`), no cambia el fallback de la clase `border`
   sola ni de `divide-x`/`divide-y` sola (confirmado con un test directo:
   `<div class="border">` con `color:red` renderiza el borde en rojo). El error concreto en
   este archivo: `divide-y border-border-muted` — alguien intentó arreglarlo agregando
   `border-{color}`, pero `divide-y` necesita específicamente `divide-{color}`.
   **Hallazgo más amplio (fuera de este fix):** el mismo error de "`divide-x`/`divide-y` sin
   `divide-{color}` explícito" aparece en ~8 archivos más del proyecto — reportado aparte
   (`spawn_task`), no se toca acá.

**Incluido en este mismo fix (mismo root cause de color, mismo copy-paste que originó cursos):**
`vehicle-maintenances.component.ts` heredó el `divide-x` sin color al copiar el patrón de card
mobile de `cursos` en `fix-133-b` — se corrige acá también por ser 1 línea, mismo archivo que
ya se tocó hoy.

## ACs Afectados

Ninguno — fix autónomo de UI, no cambia contrato de negocio.

## Cambio

1. **`admin-contabilidad-cursos.component.ts`:**
   - Migra el switch mobile/desktop a `@container` (mismo patrón `dual-viewport-container` +
     `hide-on-squeeze`/`show-on-squeeze` que `flota-list-content`/`vehicle-maintenances`):
     `<section>` → `dual-viewport-container`; vista mobile (`lg:hidden`) → `mobile-view
     show-on-squeeze`; vista desktop (`hidden lg:block`) → `desktop-view hide-on-squeeze`.
     Breakpoint 1000px — ajustado en vivo desde el 1100px inicial: el contenedor real
     (`.dual-viewport-container`) nunca supera ~1064px incluso a 1440px de viewport (shell +
     sidebar + padding), así que 1100px dejaba la vista tabla inalcanzable siempre.
   - `divide-x` (grid Precio/Inscritos/Cobrado de la card mobile) → `divide-x
     divide-border-muted`.
   - `divide-y border-border-muted` (tbody desktop) → `divide-y divide-border-muted`.
2. **`vehicle-maintenances.component.ts`:** mismo fix de color, `divide-x` → `divide-x
   divide-border-muted` en la card mobile (km/costo/taller).

## Test de Regresión

- Sin `.spec.ts` nuevo — solo clases CSS y `@container`, sin lógica nueva.
- `npx tsc --noEmit`: sin errores.
- `npm run lint:arch`: exit 0, sin warnings nuevos en los 2 archivos tocados.
- `npm run test:ci`: 156/157 test files verdes (1983/1989 tests). El único fallo
  (`cuadratura-content.component.spec.ts > mapea "combustible" a la etiqueta "Combustible"`,
  `Error: Test timed out in 5000ms`) es en un archivo **nunca tocado** en esta sesión
  (`cuadratura-content.component.ts`, componente de 990 líneas, sin relación con `cursos` ni
  `vehicle-maintenances`). Reproducido en aislado 2 veces con el mismo patrón exacto: falla
  solo el *primer* test del archivo (costo de compilación JIT de `TestBed.createComponent` de
  un componente grande sin `detectChanges()`), los 7 restantes del mismo archivo pasan
  siempre. Consistente con timeout por carga de CPU compartida con otra sesión corriendo en
  paralelo (`task_61698b8f`, spawneada en esta misma conversación) — no una regresión real.
- `/verify` manual en navegador (`ng serve --port 4210`):
  - **Breakpoint ajustado en vivo:** el plan original decía 1100px; medido en vivo, el
    `.dual-viewport-container` real nunca supera ~1064px incluso a 1440×900 (shell + sidebar +
    padding se comen el resto), así que 1100px dejaba la vista tabla inalcanzable siempre —
    bajado a 1000px, confirmado con `getComputedStyle` que la tabla activa a 1440×900
    (`desktopDisplay: 'block'`, contenedor real 957–1064px según el estado).
  - **Drawer → cards:** confirmado invocando `onHeroAction('nuevo-curso')` — con el drawer
    abierto el contenedor se angosta a 440px y cambia a `mobile-view: block` /
    `desktop-view: none` (antes se quedaba en tabla con scroll horizontal). Screenshot
    confirma visualmente: cards apiladas junto al drawer, sin scroll horizontal.
  - **Color de separadores:** confirmado con `getComputedStyle` en ambos archivos — el borde
    visible real (`borderBottomColor` en el tbody desktop, `borderRightColor` en las cards
    mobile) da `rgba(9, 9, 11, 0.06)` (token `--border-subtle`/`--border-muted` correcto) en
    vez de `rgb(9, 9, 11)` (negro pleno, el bug original).
  - Consola: solo el `InvalidStateError` preexistente, sin errores nuevos.

## Hallazgo relacionado, fuera de este fix

El mismo bug de color (`divide-x`/`divide-y` sin `divide-{color}` explícito) aparece en ~9
instancias más across 8 archivos del proyecto (drawers de certificación, `alumno-clases`,
`instructor-ficha`). Reportado como tarea aparte (spawn_task `task_61698b8f`), no se toca en
este fix por decisión explícita del usuario.
