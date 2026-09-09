# Fix: Cursos Singulares — margen real 0px entre cards mobile (gap anulado por display:block !important)
> id: fix-165-b-cursos-singulares-margen-real-cero-mobile-cards
> refs: fix-164-b-cursos-singulares-mobile-cards-hover-y-spacing, fix-163-b-host-display-block-cards-rollout
> status: done
> closed: 2026-09-08
> created: 2026-09-08

## Root Cause
Bug preexistente (no introducido por fix-164-b, que solo agregó `p-4` y `appCardHover` sin
tocar el mecanismo de spacing). El contenedor `.mobile-view` de Cursos Singulares usa
Tailwind `flex flex-col gap-3` para separar las cards, pero el propio `styles: []` del
componente define:

```css
.show-on-squeeze { display: block !important; }
```

Esa regla tiene el mismo selector de clase que Tailwind `.flex` (especificidad igual) pero
con `!important`, así que siempre gana: el contenedor termina con `display: block` real,
no `flex`. La propiedad `gap` **no tiene efecto en `display: block`** (solo aplica a
flex/grid) — confirmado en vivo: `getComputedStyle(container).display === "block"` y la
distancia real entre `card1.bottom` y `card2.top` es **0px**, pese a `gap-3` en la clase.

Es la misma familia de bug que `fix-163-b` (un mecanismo de spacing que depende de un
`display` que el elemento no tiene en runtime), pero con causa inversa: ahí un custom
element sin `:host{display:block}` quedaba `inline` y rompía `margin-top` de `space-y-4`;
acá un `!important` propio del componente fuerza `block` y rompe `gap` de `flex`. `fix-164-b`
no lo detectó porque solo validó visualmente (el screenshot mostraba los bordes de las cards
sin superposición, pero no medí la distancia real vía DOM hasta ahora).

## ACs Afectados
- Ninguno — fix autónomo, mismo alcance visual que fix-164-b (que sigue siendo válido en su
  parte de padding del contenedor y `appCardHover`).

## Cambio
- **Archivo:** `src/app/features/admin/contabilidad-cursos/admin-contabilidad-cursos.component.ts`
  - Contenedor `.mobile-view` (línea ~139): `flex flex-col gap-3` → `space-y-3`. `space-y-3`
    aplica margin entre hermanos vía selector, funciona igual con `display: block` (que es
    el valor real forzado por `!important`) — mismo mecanismo que usan `flota-list-content`
    (`space-y-4`) y `ex-alumnos-content` (`space-y-2`) para listas de cards no extraídas a
    componente. No se toca la regla `!important` de `.show-on-squeeze` (la comparten otras
    páginas con el mismo patrón dual-viewport; cambiarla es fuera de alcance).

## Test de Regresión
- Verificación en vivo (`localhost:4200`, viewport 700px): medir con
  `getBoundingClientRect()` la distancia real entre el borde inferior de la primera card y
  el borde superior de la segunda — debe ser 12px (no 0px). **Verificado**: antes del fix
  `containerDisplay: "block"` + `visualGap: 0`; después del fix, mismo `containerDisplay:
  "block"` (la regla `!important` sigue vigente, sin tocar) pero `visualGap: 12` gracias a
  `space-y-3` (margin-based, no depende de `display: flex`).
- `npm run lint:arch` → exit 0.
