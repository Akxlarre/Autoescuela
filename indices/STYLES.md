# Registro de Estilos & Design System

> **Regla de Actualización:** El Agente debe consultar esta tabla ANTES de crear estilos nuevos. Si ya existe una clase o token que resuelve la necesidad, **reutilizar**. Añadir a esta tabla cada vez que se cree un archivo de estilos nuevo.

## Design Tokens

| Archivo | Responsabilidad | Ubicación | Estado |
|---------|----------------|-----------|--------|
| `_variables.scss` | Tokens del Design System (4 capas): escala (colores, espaciado, radios, tipografía, motion), semántica (superficies, texto, bordes, sombras, estados), marca (brand, gradientes, acciones), componentes (btn, input, card, motion). Light + Dark mode. | `styles/tokens/_variables.scss` | ✅ Estable |
| `_scrollbar.scss` | Styling minimalista y dinámico para scrollbars. Integrado con tokens. Solo desktop. | `styles/tokens/_scrollbar.scss` | ✅ Estable |


## Utilities (Tailwind v4)

| Archivo | Responsabilidad | Ubicación | Estado |
|---------|----------------|-----------|--------|
| `tailwind.css` | Capa de utilidades Tailwind v4. Mapea tokens del design system vía `@theme` para clases como `text-text-secondary`, `bg-surface`, `rounded-lg`. No usa Preflight (PrimeNG tiene su propio reset). | `src/tailwind.css` | ✅ Estable |
| `postcss.config.json` | **Configuración PostCSS activa** para Tailwind v4. Angular `@angular/build:application` solo lee JSON (`postcss.config.json` / `.postcssrc.json`). Declara `@tailwindcss/postcss` como plugin. **CRÍTICO: nunca renombrar a .mjs/.js o Tailwind dejará de procesar CSS.** | `postcss.config.json` (root) | ✅ Estable |
| `postcss.config.mjs` | Legado — Angular lo ignora. Solo referencia para entender la configuración. No modificar: usar `postcss.config.json`. | `postcss.config.mjs` (root) | ⚠️ Legado |

## Layout

| Archivo | Clases principales | Ubicación | README | Estado |
|---------|-------------------|-----------|--------|--------|
| `_bento-grid.scss` | `.bento-grid`, `.bento-square`, `.bento-wide`, `.bento-tall`, `.bento-feature`, `.bento-hero`, `.bento-banner`, `.bento-card`, `.bento-media` + data-attributes de placement | `styles/layout/_bento-grid.scss` | `_bento-grid.README.md` | ✅ Estable |
| `_page-shell.scss` | `.page-centered`, `.page-narrow`, `.page-content`, `.page-wide`, `.page-split`, `.page-header`, `.page-section`, `.page-empty` | `styles/layout/_page-shell.scss` | `_page-shell.README.md` | ✅ Estable |

## Motion

| Archivo | Responsabilidad | Ubicación | README | Estado |
|---------|----------------|-----------|--------|--------|
| `_view-transitions.scss` | View Transitions API: page navigation (page-out/in asimétrico) + theme switch (reveal circular desde clic). Requiere `view-transition-name: main-content` en `.shell-content`. | `styles/motion/_view-transitions.scss` | `_view-transitions.README.md` | ✅ Estable |

## Vendors

| Archivo | Responsabilidad | Ubicación | Estado |
|---------|----------------|-----------|--------|
| `_primeng-overrides.scss` | Mapeo de tokens PrimeNG a Design System. Overrides de toast, buttons, tables, stepper (`.stepper-premium` con `--step-2` a `--step-6` vía `@for` loop), datepicker, skeleton, dark mode fixes. | `styles/vendors/_primeng-overrides.scss` | ✅ Estable |

## Estilos Globales (`styles.scss`)

| Concepto | Clases/Selectores | Propósito |
|----------|-------------------|-----------|
| Scroll locks | `body.layout-drawer-open`, `body.modal-open` | Bloqueo de scroll en drawer mobile y modales |
| Modal overlay | `.modal-overlay__wrapper` | Posicionamiento fijo del overlay de modales (z-index > topbar) |

## Reglas de Uso

1. **Layouts de página**: usar `.page-centered`, `.page-narrow`, `.page-wide`, etc. — NO crear max-width ad-hoc
2. **Grids de dashboard**: usar `.bento-grid` con clases de proporción — NO crear grids custom
3. **Colores y espaciado**: usar tokens `var(--*)` de `_variables.scss` — NUNCA valores hex/px directos
4. **Componentes PrimeNG**: los overrides ya están en `_primeng-overrides.scss` — NO sobrescribir en componentes individuales
5. **Animaciones de página**: usar View Transitions API (`_view-transitions.scss`) — NO crear transiciones de ruta custom
