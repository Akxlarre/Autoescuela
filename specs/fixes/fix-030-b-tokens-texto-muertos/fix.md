# Fix: tokens de texto muertos (text-primary/secondary/muted → text-text-*)
> id: fix-030-b-tokens-texto-muertos
> refs: 0011-auditoria-ui-ux-global (extiende H1 de UI-CONSISTENCY-AUDIT, que no cubrió esta familia)
> status: done
> closed: 2026-06-30
> created: 2026-06-30

## Root Cause
En Tailwind v4, las utilidades de color se generan **solo** desde claves `--color-*`
declaradas dentro del bloque `@theme` (`src/tailwind.css:34`). El `@theme` define
`--color-text-primary/secondary/muted`, por lo que las clases válidas son
`text-text-primary`, `text-text-secondary`, `text-text-muted`.

Las formas cortas `text-primary` / `text-secondary` / `text-muted` **no tienen** una
`--color-primary/secondary/muted` en `@theme` (`--color-primary` solo existe como
custom property cruda en `_variables.scss:209/419`, fuera del `@theme`). Por lo tanto
**Tailwind no genera CSS** para ellas y el elemento hereda el color del padre.

Verificado compilando `tailwind.css` con `@tailwindcss/postcss`: `.text-primary` /
`.text-secondary` / `.text-muted` no existen en el output; `.text-text-*` sí.

Causa de fondo: `.claude/rules/visual-system.md` documenta la forma MUERTA como canónica
("Textos: `text-primary, text-secondary, text-muted`"), induciendo el bug. `fix-015`
(remediación H1) solo cazó `bg-bg-*` y `*-state-*`, no esta familia.

## ACs Afectados
- AC (0011 / H1): "0 clases de token no canónicas que no generan CSS". Este fix extiende
  esa garantía a la familia `text-{primary,secondary,muted}` (549 usos en 39 archivos).

## Cambio
- **Templates (39 archivos):** `text-primary`→`text-text-primary`,
  `text-secondary`→`text-text-secondary`, `text-muted`→`text-text-muted`
  (word-boundary, sin tocar las formas ya canónicas `text-text-*`).
- **Casos bg/border cortos (9 usos):** caso a caso — `bg-primary`(4)→`bg-brand`,
  `bg-muted`(1)→`bg-subtle`, `border-muted`(4)→`border-border-muted` (verificar contra `@theme`).
- **Doc:** `.claude/rules/visual-system.md` → corregir la tabla de tokens de texto a `text-text-*`.
- **Linter (anotado, NO ejecutable):** `architect.js` está protegido (File Protector).
  Regla a agregar manualmente: bloquear `\b(text|bg|border)-(primary|secondary|muted)\b`.

## Test de Regresión
- Scan `scripts` (réplica de la sonda): `text-{primary,secondary,muted}` standalone = **0** usos.
- Sonda Tailwind: confirmar que el output sigue sin `.text-primary` (el bug era de uso, no de theme).
- `/verify` (Playwright) en `admin-pre-inscrito-drawer` y un módulo profesional: confirmar
  que el texto muted/secondary ahora renderiza tenue (antes salía oscuro).
