# Hotfix: Filas alternadas de `p-datatable-striped` usan un color hardcodeado de PrimeNG, no un token

> id: hotfix-040-b-datatable-striped-row-color-hardcodeado
> status: done
> closed: 2026-08-09
> created: 2026-08-09

## Problema

Reportado por el usuario en `/app/admin/flota`: "la lista en ciertos tamaños se percibe un
borde coloreado ... es por cada columna y es intercalado". Investigado en vivo con
`getComputedStyle` sobre las filas de `.p-datatable-tbody > tr`: no es un borde por columna,
es el **fondo de fila alternado** de `.p-datatable-striped` (aplicado a la `<p-table
styleClass="p-datatable-sm p-datatable-striped ...">` de `flota-list-content.component.ts`),
que cruza las 7-8 columnas completas y por eso se percibe como una franja/"borde" horizontal
que se repite cada dos filas.

`_primeng-overrides.scss` mapea `--p-datatable-row-background` y
`--p-datatable-row-hover-background` a tokens del Design System, pero **nunca definió**
`--p-datatable-row-striped-background`. PrimeNG usa su default del preset Aura: `#f8fafc`
(un gris casi blanco), un hex **hardcodeado ajeno al sistema de tokens** y que no se adapta a
dark mode — confirmado en vivo: filas pares con `background-color: rgb(248, 250, 252)`
(= `#f8fafc`) intercaladas con filas impares en `rgb(24, 24, 27)` (= `--bg-surface` dark,
correcto). Viola la regla de `visual-system.md` "Tokens de color (PROHIBIDO hardcodear)".

Cualquier tabla del proyecto con `p-datatable-striped` en dark mode tiene este mismo defecto
(no es exclusivo de flota) — el fix es a nivel del override global, no del componente.

## Cambios

- **Archivo:** `src/styles/vendors/_primeng-overrides.scss` — en el bloque `:root` de la
  sección "Tables" (junto a `--p-datatable-row-background` / `--p-datatable-row-hover-background`),
  agrega `--p-datatable-row-striped-background: var(--bg-subtle);`. `--bg-subtle` ya es el
  token semántico existente para "superficie ligeramente distinta" (usado en `--btn-ghost-bg-hover`,
  `--btn-neutral-bg`) y ya tiene su propio valor correcto en light (`#e4e4e7`) y dark
  (`#2d2d30`), así que el striping queda sutil y coherente con el tema activo sin tocar
  ningún componente individual.
