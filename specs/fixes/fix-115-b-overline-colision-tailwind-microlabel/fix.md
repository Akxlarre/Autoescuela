# Fix: `.overline` del DS colisiona con la utilidad nativa de Tailwind `overline`
> id: fix-115-b-overline-colision-tailwind-microlabel
> refs: fix-078-b-vocabulario-tipografico-ds
> status: done
> closed: 2026-08-04
> created: 2026-08-03

## Root Cause

`fix-078-b` (commit `f170da4`) migró ~221 usos ad-hoc de micro-labels a una clase única del
design system: `.overline` (`src/styles/tokens/_variables.scss`), pensada como "etiqueta corta
en mayúsculas sobre cualquier dato o bloque" (label de KPI, cabecera de grupo, título de
columna, etiqueta de campo en modo lectura).

El problema: `overline` **también es el nombre de una utilidad nativa de Tailwind CSS**
(`text-decoration-line: overline`, familia `underline`/`overline`/`line-through`). Tailwind v4
escanea el contenido (`@source` en `src/tailwind.css`) buscando strings que coincidan con
utilidades conocidas. Al ver el literal `"overline"` en `class="..."` en 141 lugares, genera su
propia regla dentro de `@layer utilities`:

```css
.overline { text-decoration-line: overline; }
```

Confirmado compilando el CSS real del proyecto vía `@tailwindcss/postcss` (Node, ad-hoc).

Como la regla del DS (`_variables.scss`, sin `@layer` → gana por cascada) y la de Tailwind
(`@layer utilities`) **no comparten ninguna propiedad CSS**, ambas se aplican al mismo tiempo:
el elemento queda con el estilo correcto de micro-label (mayúsculas, `text-muted`, `text-xs`)
**y además** con una línea física dibujada encima del texto — visible en cabeceras de tabla como
"Alumno" o "RUT" en Base de Alumnos, y en cualquier otro lugar que use `.overline`.

Antes de `fix-078-b` nadie usaba el string literal `"overline"` como clase, así que Tailwind
nunca generaba esa utilidad — de ahí que el bug no existiera antes de esa migración.

Auditoría de todas las clases del DS (`_variables.scss`, `_bento-grid.scss`, `_page-shell.scss`,
`_form-fields.scss`): `.overline` es la **única** que colisiona con una utilidad "bare" (sin
sufijo) de Tailwind. El resto son siempre nombres compuestos con guion (`.item-title`,
`.card-tinted`, `.bento-*`, `.field-*`), lo que por construcción no choca — las utilidades bare
de Tailwind son casi todas palabras sueltas (`flex`, `hidden`, `truncate`, `italic`, `underline`,
`overline`, `sticky`, `resize`, `grow`, `shrink`, `border`, `rounded`, `shadow`, `ring`,
`container`...).

## ACs Afectados

Ninguno — fix autónomo de un bug visual transversal, sin AC de spec previa.

## Cambio

Dos partes, misma causa raíz:

1. **Rename `.overline` → `.micro-label`** (nombre compuesto, consistente con `.item-title` /
   `.section-eyebrow`, sin colisión posible):
   - `src/styles/tokens/_variables.scss` — definición de la clase (se mantiene `.kpi-label` tal
     cual, como alias deprecado, sin tocar — no colisiona con Tailwind).
   - 141 ocurrencias de `class="...overline..."` en 46 archivos bajo `src/app/`.
   - Referencias en `.claude/rules/visual-system.md` e `indices/STYLES.md`.

2. **Guardrail ARCH-22**: `scripts/lib/tailwind-bare-utilities.js` — lista de utilidades bare
   reservadas + función de detección pura (`findReservedTailwindClassCollisions`), con su
   propio test (`scripts/lib/tailwind-bare-utilities.test.mjs`, 17/17 casos OK), siguiendo el
   patrón de `class-discipline.js` / `class-discipline.test.mjs`. Funciona standalone
   (`node scripts/lib/tailwind-bare-utilities.js` → confirmado 0 colisiones en
   `_variables.scss` tras el rename).
   El wiring dentro de `npm run lint:arch` (mismo patrón que ARCH-18/20/21: auditoría puntual
   de un archivo, no por-archivo de proyecto) requiere editar `scripts/architect.js`, que el
   File Protector bloquea para el agente — instrucciones exactas en
   `architect-js-patch.md` (este mismo track), pendientes de que el humano las aplique.
   El patch también corrige el mensaje de ARCH-19, que citaba el nombre viejo `.overline`.

## Test de Regresión

- `scripts/lib/tailwind-bare-utilities.test.mjs` — nuevo test unitario: detecta colisión para
  `overline` (caso real) y para clases inventadas que coincidan con utilidades bare conocidas
  (`flex`, `truncate`, `container`...); no marca falso positivo en nombres compuestos existentes
  del DS (`item-title`, `card-tinted`, `bento-hero`...). ✅ 17/17 casos OK.
- `node scripts/lib/tailwind-bare-utilities.js` (standalone) — ✅ 0 colisiones en
  `_variables.scss` tras el rename. `npm run lint:arch` con ARCH-22 cableado queda pendiente
  de que el humano aplique `architect-js-patch.md` (protegido).
- Verificación visual en vivo (Playwright/`/verify`): Base de Alumnos y al menos 2 pantallas más
  que usan `.micro-label` (ex `.overline`), en modo claro y oscuro — sin línea sobre el texto.
- `npx ng build` sin errores.
