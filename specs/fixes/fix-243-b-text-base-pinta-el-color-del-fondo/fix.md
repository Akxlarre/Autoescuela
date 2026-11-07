# Fix: text-base pinta el texto con el color del fondo — guardrail que lo prohíbe
> id: fix-243-b-text-base-pinta-el-color-del-fondo
> refs: fix-303-m (corrigió los 5 textos ilegibles y dejó pendiente el guardrail), fix-242-b (la marca del login cayó en lo mismo)
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Root Cause
El `@theme` de `src/tailwind.css` define `--color-base` (el fondo de la página) y el tema por
defecto de Tailwind define `--text-base` (16 px). `text-base` queda ambigua entre color y tamaño, y
Tailwind la resuelve como **color**: compilando el `tailwind.css` del proyecto, `text-base` genera
solo `color: var(--color-base)`, sin `font-size`. Lo mismo `sm:text-base`, `md:text-base`, etc.

Un texto con esa clase y sin otro color que gane se pinta casi blanco en modo claro y casi negro
en oscuro. fix-303-m corrigió los 5 casos visibles; fix-242-b volvió a caer en lo mismo con la
marca del login, porque nada avisa al escribir la clase.

Hoy quedan 22 usos en 15 archivos. En todos gana otro color (`text-text-*`, `[style.color]`, la
regla de `form-control` o un `!important`), así que la clase no hace nada.

## ACs Afectados
Ninguno de una spec — fix autónomo del DS.
- `npm run lint:arch` falla si un archivo de `src/app` usa `text-base` (con o sin variante), y
  dice qué usar en su lugar.
- `npm run lint:arch` falla si el `@theme` agrega un `--color-X` cuyo nombre ya es un tamaño de
  letra (`xs`, `sm`, `lg`, `2xl`…): el mismo choque con otro nombre.
- No queda ningún `text-base` en `src/app`. Ningún texto cambia de color ni de tamaño.

## Decisión
Se eligió con el humano **prohibir la clase** en vez de renombrar `--color-base` (p. ej. a
`--color-page`). Renombrar tocaba ~97 usos de `bg-base` en ~50 archivos y además le devolvía los
16 px a `text-base`, cambiando de tamaño a los 22 textos que hoy la llevan sin efecto. Prohibirla
deja la app idéntica. La colisión aceptada queda declarada, con su motivo, en `ACCEPTED_COLLISIONS`.

## Cambio
- `scripts/lib/theme-name-collisions.js` (nuevo) + `theme-name-collisions.test.mjs` (31 casos):
  detecta colores del `@theme` cuyo nombre ya es un tamaño de letra o de sombra (tema por defecto
  de Tailwind + `--text-*`/`--shadow-*` del proyecto), y los usos de la clase ambigua con cualquier
  variante (`md:`, `!`, `/50`, `[class.…]`, `@apply`). Ignora comentarios y `var(--text-base)`.
- `scripts/check-theme-name-collisions.mjs` (nuevo): runner de **ARCH-29** sobre `src/`, error
  duro sin línea base. Cableado en `scripts/lint-arch-wrapper.js` como paso propio, igual que
  ARCH-27/28, porque `scripts/architect.js` está protegido.
- Se quita `text-base` / `sm:text-base` de los 22 usos (16 archivos de `src/app`).
- Documentación: `.claude/rules/visual-system.md` (§Tokens de color), `indices/ANTI-PATTERNS.md`
  (AP-018), `indices/STYLES.md` (tabla de tokens `@theme`).

## Test de Regresión
- Compilando `src/tailwind.css` con el `compile()` de Tailwind: `text-base` → `color: var(--color-base)`
  sin `font-size`; `md:text-base` igual dentro de `@media`. Es la única colisión del tema actual.
- `node scripts/lib/theme-name-collisions.test.mjs`: 31/31 ✓
- `node scripts/check-theme-name-collisions.mjs`: antes del cambio, 22 errores (exactamente los 22
  usos; ninguno de los 4 comentarios que nombran la clase). Con un `.html` de prueba con
  `md:text-base` → exit 1 con ARCH-29. Después del cambio → ✓.
- `npm run lint:arch`: 0 errores ✓ (ARCH-29 incluido).
- `npm run test:ci`: 4.686 pasan, 5 omitidos, 1 falla ajena a este fix: `agenda.facade.spec.ts > hotfix-077-b` arma
  el horario en `chileToday()`, y hoy (sábado 2026-11-07) cae fuera de la semana lunes–viernes de la agenda.
  Falla igual en `main` sin este cambio; solo pasa de lunes a viernes.
- Navegador (`ng serve` :4210, página 404 pública, sin sesión), color/tamaño calculados:
  - Sonda `font-semibold text-base` vs `font-semibold`: claro `rgb(244,244,245)` (el fondo) vs
    `rgb(9,9,11)`; oscuro `rgb(9,9,11)` vs `rgb(243,243,244)`. Con `text-text-primary`,
    `text-text-muted` o `text-text-secondary` al lado, con y sin `text-base` da lo mismo en los dos
    modos y el tamaño no cambia (16 px).
  - Texto real de la 404, antes (`text-base text-text-muted`) y después (`text-text-muted`): claro
    `rgb(99,99,107)` 16 px, oscuro `rgb(152,152,159)` 16 px en ambos casos.

## Límites conocidos
- Las pantallas del admin e instructor no se abrieron en pantalla: piden sesión y `ng serve` usa el
  Supabase de producción. En los 22 usos gana otro color (`text-text-*`, `[style.color]`, la regla
  de `form-control`, el `!important` de `evaluation-checklist`) y la clase no fija tamaño, así que
  quitarla no cambia nada; la sonda de arriba mide esas mismas combinaciones.
- El guardrail corre en `npm run lint:arch`, no al escribir: el guard de escritura vive en
  `.claude/hooks/`, que está protegido. Si se quiere el aviso en tiempo real, el humano puede sumar
  `findCollidingClassUsages` a `pre-write-guard.js`.
