# Brand Guidelines y Theming

> Este documento es la guía de alto nivel. Para detalles técnicos de cada
> sistema, ver los READMEs correspondientes y `indices/STYLES.md`.

## Stack de Estilos

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Design Tokens | SCSS (`_variables.scss`) | Colores, espaciado, tipografía, motion, dark mode |
| Layouts | SCSS (`_bento-grid.scss`, `_page-shell.scss`) | Grid components y page patterns |
| Vendors | SCSS (`_primeng-overrides.scss`) | Mapeo de PrimeNG a design system |
| Utilidades | Tailwind CSS v4 (`tailwind.css`) | Clases utilitarias mapeadas a tokens |
| Animaciones | GSAP (`GsapAnimationsService`) | Toda la motion via servicio centralizado |

## Regla #1 — Siempre usar Tokens

```html
<!-- ✅ Correcto: utility class mapeada a token -->
<p class="text-text-secondary text-sm">Descripción</p>
<div class="bg-surface rounded-lg shadow-md p-6">...</div>

<!-- ✅ Correcto: CSS variable directo -->
<p style="color: var(--text-secondary)">Descripción</p>

<!-- ❌ Prohibido: colores arbitrarios -->
<p class="text-[#52525b]">Nunca hardcodear</p>
<p style="color: #52525b">Nunca hardcodear</p>
```

## Regla #2 — Cuándo usar Tailwind vs SCSS

| Usar Tailwind (utilities) | Usar SCSS (custom) |
|---|---|
| Spacing: `p-4`, `mt-2`, `gap-3` | Layouts complejos: bento grid, page shell |
| Colores semánticos: `text-text-muted`, `bg-surface` | Mixins y loops de SCSS |
| Flexbox/grid simple: `flex items-center` | Componentes con animación GSAP |
| Bordes y radios: `rounded-lg`, `border-border-default` | Overrides de PrimeNG |
| Responsive rápido: `md:flex-row` | — |

## Regla #3 — Jerarquía de Superficies

```
bg-base      → Fondo de la app
bg-surface   → Cards, modales, sidebar
bg-elevated  → Hover de filas, áreas diferenciadas
bg-subtle    → Inputs, chips, separadores
```

Siempre respetar esta jerarquía. Un card (`bg-surface`) no va sobre otro card.

## Regla #4 — Color de Texto ≠ Color de Acción

- `text-primary / text-secondary / text-muted` → solo para texto
- `brand / brand-hover` → solo para botones, links, CTAs

**NUNCA** usar un color de acción como color de texto ni viceversa.

## Regla #5 — Animación solo via GSAP

No usar CSS `@keyframes` para animaciones de componentes.
Inyectar `GsapAnimationsService` y usar sus métodos.

**Excepción**: `_view-transitions.scss` usa `@keyframes` para las
transiciones de página (View Transitions API), que son del navegador.

## Referencias

- **Tokens del design system**: `styles/tokens/_variables.scss`
- **Layout patterns**: `_bento-grid.README.md`, `_page-shell.README.md`
- **View Transitions**: `_view-transitions.README.md`
- **Índice completo**: `indices/STYLES.md`
