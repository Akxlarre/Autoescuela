# Registro de Estilos & Design System

> **Regla de Actualización:** El Agente debe consultar esta tabla ANTES de crear estilos nuevos. Si ya existe una clase o token que resuelve la necesidad, **reutilizar**. Añadir a esta tabla cada vez que se cree un archivo de estilos nuevo.

## Design Tokens

| Archivo | Responsabilidad | Ubicación | Estado |
|---------|----------------|-----------|--------|
| `_variables.scss` | Tokens del Design System (4 capas): escala (colores, espaciado, radios, tipografía, motion), semántica (superficies, texto, bordes, sombras, estados), marca (brand, gradientes, acciones), componentes (btn, input, card, motion). Light + Dark mode. Clases semánticas globales: `.kpi-value`, `.kpi-label`, `.section-eyebrow`, `.surface-hero`, `.surface-glass`, `.indicator-live`, `.badge-pulse`. | `styles/tokens/_variables.scss` | ✅ Estable |
| `_scrollbar.scss` | Styling minimalista y dinámico para scrollbars. Integrado con tokens. Solo desktop. | `styles/tokens/_scrollbar.scss` | ✅ Estable |


## Themes (scoped por sede)

Overrides de tokens que aplican SOLO bajo un selector de scope (nunca en `:root`). Se montan en `styles.scss` vía `@use`.

| Archivo | Responsabilidad | Scope | Ubicación | Estado |
|---------|----------------|-------|-----------|--------|
| `_public-enrollment.scss` | Tematización del flujo público de inscripción (spec 0009): ramps de sede **azul** (sky+indigo) y **roja** (red+orange) mapeadas a los tokens DS (`--ds-brand`, `--color-primary*`, `--gradient-hero`, superficies, `--border-*`) + puente Tailwind `--color-*`. Override de fuentes a **Outfit/Inter** y **forzado de modo claro** (revierte `[data-mode='dark']`). Expone `--pe-brand-*`, `--pe-accent-*`, `--pe-gradient-badge`, `--pe-shadow-xl` para los componentes públicos. Hex de sede aprobados en `docs/mockups/inscripcion-rediseno.html`. | `[data-public-theme="azul"\|"roja"]` | `styles/themes/_public-enrollment.scss` | ✅ Estable |


## Utilities (Tailwind v4)

| Archivo | Responsabilidad | Ubicación | Estado |
|---------|----------------|-----------|--------|
| `tailwind.css` | Capa de utilidades Tailwind v4. Mapea tokens del design system vía `@theme` para clases como `text-text-secondary`, `bg-surface`, `rounded-lg`. No usa Preflight (PrimeNG tiene su propio reset). | `src/tailwind.css` | ✅ Estable |

### Tokens `@theme` disponibles (→ clases Tailwind generadas)

| Token CSS (`var(--)`) | Clase `bg-*` | Clase `border-*` | Clase `text-*` |
|-----------------------|-------------|-----------------|---------------|
| `--ds-brand` | `bg-brand` / `bg-brand/N` | `border-brand` / `border-brand/N` | `text-brand` |
| `--color-primary-muted` | `bg-brand-muted` | `border-brand-muted` | — |
| `--color-primary-tint` | `bg-brand-tint` | — | — |
| `--color-primary-dark` | `bg-brand-dark` / `bg-brand-dark/N` | — | — |
| `--bg-base` | `bg-base` | — | — |
| `--bg-surface` | `bg-surface` / `bg-surface/N` | — | — |
| `--bg-elevated` | `bg-elevated` | — | — |
| `--bg-subtle` | `bg-subtle` | — | — |
| `--overlay-backdrop` | `bg-overlay` | — | — |
| `--text-primary` | `bg-text-primary` | — | `text-text-primary` |
| `--text-secondary` | — | — | `text-text-secondary` |
| `--text-muted` | `bg-text-muted` / `bg-text-muted/N` | — | `text-text-muted` |
| `--border-subtle` | `bg-border-subtle` | `border-border-subtle` | — |
| `--border-muted` | `bg-border-muted` | `border-border-muted` | — |
| `--border-default` | — | `border-border-default` | — |
| `--state-success` | `bg-success` / `bg-success/N` | `border-success` / `border-success/N` | `text-success` |
| `--state-success-bg` | `bg-success-subtle` | — | — |
| `--state-success-border` | — | `border-success-border` | — |
| `--state-warning` | `bg-warning` / `bg-warning/N` | `border-warning` / `border-warning/N` | `text-warning` |
| `--state-warning-bg` | `bg-warning-subtle` | — | — |
| `--state-warning-border` | — | `border-warning-border` | — |
| `--state-error` | `bg-error` / `bg-error/N` | `border-error` / `border-error/N` | `text-error` |
| `--state-error-bg` | `bg-error-subtle` | — | — |
| `--state-error-border` | — | `border-error-border` | — |
| `--state-info` | `bg-info` / `bg-info/N` | `border-info` | `text-info` |
| `--state-info-bg` | `bg-info-subtle` | — | — |
| `--state-info-border` | — | `border-info-border` | — |

> **Patrón `/N` (opacity modifier):** En Tailwind v4, todos los colores en `@theme` soportan `bg-TOKEN/N` y `border-TOKEN/N` donde N es el porcentaje de opacidad (1–100). Equivale a `color-mix(in oklch, var(--color-TOKEN) N%, transparent)`. Reemplaza los `style="background: color-mix(...)"` inline.

### Utilities `@utility` en `tailwind.css`

| Clase | CSS generado | Cuándo usar |
|-------|-------------|-------------|
| `bg-gradient-primary` | `background: var(--gradient-primary)` | Fondo degradado sky→indigo (2 paradas) |
| `postcss.config.json` | **Configuración PostCSS activa** para Tailwind v4. Angular `@angular/build:application` solo lee JSON (`postcss.config.json` / `.postcssrc.json`). Declara `@tailwindcss/postcss` como plugin. **CRÍTICO: nunca renombrar a .mjs/.js o Tailwind dejará de procesar CSS.** | `postcss.config.json` (root) | ✅ Estable |
| `postcss.config.mjs` | Legado — Angular lo ignora. Solo referencia para entender la configuración. No modificar: usar `postcss.config.json`. | `postcss.config.mjs` (root) | ⚠️ Legado |

## Component Utility Classes (`tailwind.css`)

Clases de botón definidas con `@utility` en `src/tailwind.css`. Usar SIEMPRE estas clases en lugar de componer Tailwind ad-hoc.

| Clase | Apariencia | Cuándo usar |
|-------|-----------|-------------|
| `btn-primary` | Fondo brand, texto blanco. `:disabled` → fondo `--bg-subtle`, texto `--text-muted`, sin sombra (hotfix-005) — visualmente gris neutro para máximo contraste vs estado habilitado. Dentro de `surface-hero` se invierte (blanco + brand text) por cascade. **NO agregar `[style.opacity]` o `[style.cursor]` inline — el `:disabled` CSS los maneja.** | CTA principal de la sección |
| `btn-secondary` | Borde sutil, fondo translúcido. **Afectado por cascade `surface-hero`** → glass blanco. | Acción secundaria estándar |
| `btn-ghost` | Sin borde, fondo transparente. Hover: `bg-subtle` + texto sube a `text-primary`. Tokens `--btn-ghost-*`. | Acción terciaria discreta (filas de tabla, listas) |
| `btn-warning-soft` | Fondo `--state-warning-bg`, texto `--state-warning`, borde `--state-warning-border`. Dark-mode aware vía tokens. | Acción de transición de estado warning (ej: "Iniciar") |
| `btn-success-soft` | Fondo `--state-success-bg`, texto `--state-success`, borde `--state-success-border`. Dark-mode aware vía tokens. | Acción de confirmación positiva (ej: "Completar") |
| `btn-danger-ghost` | **Fondo blanco puro, borde rojo-300, texto rojo-600**. Usa `theme()` — **inmune a cascade** de `surface-hero`. Hover: rojo-50. | Acción destructiva en heroes/cabeceras |
| `btn-danger-solid` | **Fondo rojo-600, texto blanco**. Hover: rojo-700. Padding ligeramente mayor (`py-2.5 px-5`). | Confirmación de acción destructiva (modales) |
| `btn-neutral` | **Fondo gris-100, texto gris-700**. Hover: gris-200. Padding igual que `btn-danger-solid`. | Cancelar/cerrar en modales (sin dependencia de cascade) |
| `btn-outline` | Borde `--border-muted`, fondo `--bg-surface`, texto `--text-primary`. Hover: `--bg-elevated`. `:disabled` → opacity 0.4 + cursor not-allowed via CSS. Dark-mode aware vía tokens. | Botones secundarios de paginación, acciones de peso medio |

> **Nota cascade:** `btn-danger-ghost`, `btn-danger-solid` y `btn-neutral` usan valores `theme()` de Tailwind, no `var(--)` tokens, por lo que **no son afectados** por los overrides de `.surface-hero`. Usar estos cuando el botón debe mantener su color independientemente del contexto.

### Badge de estado (`badge-*`)

Clases para indicadores de estado con fondo diluido. Usan tokens `--state-*` del DS — dark-mode aware. Padding compacto `py-0.5 px-2`, `border-radius: var(--radius-md)`, `font-size: 0.75rem`.

| Clase | Color de estado | Cuándo usar |
|-------|----------------|-------------|
| `badge-warning` | `--state-warning` (ámbar) | Advertencias, pendientes, estados intermedios |
| `badge-success` | `--state-success` (verde) | Aprobados, completados, activos |
| `badge-error` | `--state-error` (rojo) | Errores, rechazados, fallidos |
| `badge-info` | `--state-info` (azul) | Información neutral, en progreso |

> Preferir `[class.badge-success]="condition"` sobre `[style.background]="color-mix(...)"` para estado dinámico.

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
| `_primeng-overrides.scss` | Mapeo de tokens PrimeNG a Design System. Overrides de toast, buttons, tables, stepper (`.stepper-premium`), datepicker, skeleton, dark mode fixes y **Tooltips Premium** (Glassmorphic dark charcoal, backdrop blur y alineación de flechas). | `styles/vendors/_primeng-overrides.scss` | ✅ Estable |
| `_flag-icons.scss` | Subconjunto de flag-icons para el dropdown de teléfono. Define `.fi`, `.fi.fis` (1em×1em, background-size:contain) y `.fi-{cc}.fis` para 8 países: `cl ar pe bo co ve es us`. SVGs servidos como assets estáticos desde `/flags/` (angular.json assets config → `node_modules/flag-icons/flags/1x1/*.svg`). No usar la CSS completa de flag-icons (conflicto 4x3 vs 1x1 en esbuild dev mode). | `styles/vendors/_flag-icons.scss` | ✅ Estable |

## Estilos Globales (`styles.scss`)

| Concepto | Clases/Selectores | Propósito |
|----------|-------------------|-----------|
| Scroll locks | `body.layout-drawer-open`, `body.modal-open` | Bloqueo de scroll en drawer mobile y modales |
| Modal overlay | `.modal-overlay__wrapper` | Posicionamiento fijo del overlay de modales (z-index > topbar) |

## Clases Semánticas Globales (`_variables.scss`)

| Clase | Propósito | Cuándo usar |
|-------|-----------|-------------|
| `.kpi-value` | Número KPI principal — `font-display`, clamp 2xl→4xl, tabular-nums | Métricas numéricas en dashboards y cards |
| `.kpi-label` | Etiqueta de KPI — `text-xs`, uppercase, `tracking-wider`, muted | **Solo** etiquetas de datos numéricos. NUNCA para contexto de sección |
| `.section-eyebrow` | Línea de contexto pre-título — `text-sm`, `font-medium`, color secondary, sin uppercase | `contextLine` en `app-section-hero`, cabeceras de sección, breadcrumb textual |
| `.surface-hero` | Superficie gradient (sky→indigo→violet) con glow overlay | Banners, `app-section-hero` variant full, CTAs de alta jerarquía |
| `.surface-glass` | Overlay glass con backdrop-blur | Modales flotantes, panels, tooltips ricos |
| `.indicator-live` | Dot verde pulsante — sistema activo / conexión online | Indicadores de estado en tiempo real |
| `.badge-pulse` | Badge con pulso de atención | Conteos sin leer, alertas nuevas |

> **⚠️ Distinción clave:** `.kpi-label` ≠ `.section-eyebrow`. La primera es para datos numéricos (uppercase + tracking agresivo). La segunda es para texto de contexto pre-título (natural, legible).

## Token Cascade en `.surface-hero`

`.surface-hero` incluye **15 overrides de tokens CSS** que cascadean automáticamente a todos los hijos. Usar `surface-hero` en un contenedor adapta colores sin ningún cambio en el HTML hijo:

| Token sobreescrito | Valor dentro de surface-hero | Efecto en clases Tailwind |
|--------------------|------------------------------|---------------------------|
| `--text-primary` | `var(--color-primary-text)` → `#fff` | `text-text-primary` = blanco |
| `--text-secondary` | `rgba(255,255,255,0.78)` | `text-text-secondary` = blanco/78% |
| `--text-muted` | `rgba(255,255,255,0.55)` | `text-text-muted` = blanco/55% |
| `--bg-subtle` | `rgba(255,255,255,0.10)` | `bg-subtle`, `hover:bg-subtle` = glass |
| `--border-subtle` | `rgba(255,255,255,0.18)` | `border-border-subtle` = glass |
| `--color-brand` | `rgba(255,255,255,1)` | `text-brand`, `bg-brand/10`, `hover:text-brand` = blanco |
| `--btn-primary-bg/text` | blanco / `var(--ds-brand)` | `btn-primary` = blanco + brand text (inverso) |
| `--btn-secondary-*` | glass blanco | `btn-secondary` = ghost blanco translúcido |

## Reglas de Uso

1. **Layouts de página**: usar `.page-centered`, `.page-narrow`, `.page-wide`, etc. — NO crear max-width ad-hoc
2. **Grids de dashboard**: usar `.bento-grid` con clases de proporción — NO crear grids custom
3. **Colores y espaciado**: usar tokens `var(--*)` de `_variables.scss` — NUNCA valores hex/px directos
4. **Componentes PrimeNG**: los overrides ya están en `_primeng-overrides.scss` — NO sobrescribir en componentes individuales
5. **Animaciones de página**: usar View Transitions API (`_view-transitions.scss`) — NO crear transiciones de ruta custom
6. **Contexto gradient**: dentro de `.surface-hero`, NO agregar clases de color condicionales — el token cascade lo resuelve automáticamente

## Auto-Index — Métricas del Design System (generado automáticamente)

<!-- AUTO-GENERATED:BEGIN -->
## Tokens canónicos — top 25 por frecuencia de uso real

| Token | Usos | Valor |
|-------|------|-------|
| `--ds-brand` | 482 | `#38bdf8` |
| `--text-muted` | 437 | `rgba(255, 255, 255, 0.55)` |
| `--text-primary` | 292 | `var(--color-primary-text)` |
| `--border-subtle` | 244 | `rgba(255, 255, 255, 0.18)` |
| `--state-error` | 244 | `#f87171` |
| `--text-secondary` | 235 | `rgba(255, 255, 255, 0.78)` |
| `--state-success` | 230 | `#4ade80` |
| `--bg-surface` | 200 | `#18181b` |
| `--color-primary` | 190 | `#38bdf8` |
| `--state-warning` | 168 | `#fbbf24` |
| `--border-default` | 152 | `rgba(255, 255, 255, 0.28)` |
| `--bg-elevated` | 90 | `#27272a` |
| `--text-sm` | 81 | `0.875rem` |
| `--bg-subtle` | 79 | `rgba(255, 255, 255, 0.1)` |
| `--duration-fast` | 74 | `200ms` |
| `--radius-md` | 65 | `10px` |
| `--bg-base` | 56 | `#09090b` |
| `--font-display` | 55 | `'Bricolage Grotesque', system-ui, sans-serif` |
| `--border-muted` | 54 | `var(--border-subtle)` |
| `--state-success-bg` | 52 | `rgba(74, 222, 128, 0.1)` |
| `--color-primary-text` | 48 | `#ffffff` |
| `--state-warning-bg` | 47 | `rgba(251, 191, 36, 0.1)` |
| `--text-xs` | 46 | `0.75rem` |
| `--color-success` | 45 | `—` |
| `--color-primary-muted` | 44 | `rgba(56, 189, 248, 0.15)` |

## Clases semánticas del Design System

| Clase | Usos en templates | Archivo |
|-------|------------------|---------|
| `.card` | 479 | `src/styles/tokens/_variables.scss` |
| `.kpi-label` | 25 | `src/styles/tokens/_variables.scss` |
| `.kpi-value` | 16 | `src/styles/tokens/_variables.scss` |
| `.card-accent` | 11 | `src/styles/tokens/_variables.scss` |
| `.card-tinted` | 10 | `src/styles/tokens/_variables.scss` |
| `.surface-glass` | 9 | `src/styles/tokens/_variables.scss` |
| `.surface-hero` | 6 | `src/styles/tokens/_variables.scss` |
| `.indicator-live` | 5 | `src/styles/tokens/_variables.scss` |
| `.section-eyebrow` | 1 | `src/styles/tokens/_variables.scss` |
| `.badge-pulse` | 1 | `src/styles/tokens/_variables.scss` |

## Bento Grid — Clases de celda disponibles

| Clase CSS | Proporción |
|-----------|-----------|
| `.bento-1x1` | — |
| `.bento-2x1` | — |
| `.bento-2x2` | — |
| `.bento-3x1` | — |
| `.bento-3x2` | — |
| `.bento-4x1` | — |
| `.bento-activity-lg` | — |
| `.bento-alerts-lg` | — |
| `.bento-banner` | 100% ancho — para tablas y listados |
| `.bento-card` | Alias visual de celda con card |
| `.bento-card--flush` | — |
| `.bento-card__body` | — |
| `.bento-card__body--bottom` | — |
| `.bento-card__body--center` | — |
| `.bento-card__body--spread` | — |
| `.bento-feature` | 2/3 ancho × 2 filas |
| `.bento-grid` | Contenedor raíz (con [appBentoGridLayout]) |
| `.bento-grid--forms` | — |
| `.bento-grid--four-equal` | — |
| `.bento-grid--wizard` | — |
| `.bento-hero` | 100% ancho — para app-section-hero |
| `.bento-media` | Celda de media (imagen/video) |
| `.bento-media--center` | — |
| `.bento-media--left` | — |
| `.bento-media--top` | — |
| `.bento-square` | 1/3 ancho (cuadrado) |
| `.bento-tall` | 1/3 ancho × 2 filas |
| `.bento-wide` | 2/3 ancho |

## PrimeNG — Componentes con override en _primeng-overrides.scss

| Componente | Selectores |
|-----------|-----------|
| **avatar** | `.p-avatar` |
| **badge** | `.p-badge` |
| **breadcrumb** | `.p-breadcrumb` · `.p-breadcrumb-chevron` · `.p-breadcrumb-home` · `.p-breadcrumb-separator` |
| **button** | `.p-button` · `.p-button-danger` · `.p-button-icon-only` · `.p-button-outlined` · `.p-button-primary` +3 |
| **card** | `.p-card` |
| **checkbox** | `.p-checkbox` · `.p-checkbox-box` |
| **colorpicker** | `.p-colorpicker` · `.p-colorpicker-panel` |
| **datatable** | `.p-datatable` · `.p-datatable-header` · `.p-datatable-sm` · `.p-datatable-table` · `.p-datatable-table-wrapper` +3 |
| **datepicker** | `.p-datepicker` · `.p-datepicker-day` · `.p-datepicker-dropdown` · `.p-datepicker-header` · `.p-datepicker-next` +5 |
| **dialog** | `.p-dialog` · `.p-dialog-content` · `.p-dialog-header` · `.p-dialog-mask` |
| **disabled** | `.p-disabled` |
| **focus** | `.p-focus` |
| **highlight** | `.p-highlight` |
| **ink** | `.p-ink` |
| **inputnumber** | `.p-inputnumber` · `.p-inputnumber-input` |
| **inputtext** | `.p-inputtext` |
| **inputwrapper** | `.p-inputwrapper` |
| **menu** | `.p-menu` · `.p-menu-item-content` · `.p-menu-item-link` · `.p-menu-item-link-active` · `.p-menu-list` +1 |
| **menuitem** | `.p-menuitem-badge` · `.p-menuitem-link` · `.p-menuitem-text` |
| **monthpicker** | `.p-monthpicker-month` |
| **multiselect** | `.p-multiselect` · `.p-multiselect-panel` |
| **overlay** | `.p-overlay-mask` |
| **progressbar** | `.p-progressbar` · `.p-progressbar-value` |
| **select** | `.p-select` · `.p-select-item` · `.p-select-item-focus` · `.p-select-label` · `.p-select-list` +6 |
| **skeleton** | `.p-skeleton` |
| **sortable** | `.p-sortable-column` |
| **step** | `.p-step` · `.p-step-header` · `.p-step-number` · `.p-step-title` |
| **steplist** | `.p-steplist` |
| **steppanel** | `.p-steppanel` · `.p-steppanel-content` |
| **steppanels** | `.p-steppanels` |
| **stepper** | `.p-stepper` · `.p-stepper-nav` · `.p-stepper-panels` · `.p-stepper-separator` |
| **tab** | `.p-tab` · `.p-tab-active` |
| **tablist** | `.p-tablist` |
| **tabpanel** | `.p-tabpanel` |
| **tabs** | `.p-tabs` |
| **toast** | `.p-toast` · `.p-toast-close-button` · `.p-toast-close-icon` · `.p-toast-detail` · `.p-toast-message` +11 |
| **togglebutton** | `.p-togglebutton` · `.p-togglebutton-checked` |
| **toggleswitch** | `.p-toggleswitch` · `.p-toggleswitch-checked` |
| **tooltip** | `.p-tooltip` · `.p-tooltip-arrow` · `.p-tooltip-bottom` · `.p-tooltip-left` · `.p-tooltip-right` +2 |
| **yearpicker** | `.p-yearpicker-year` |

## Tipografía — drift de utilidades

> Conteo crudo de utilidades de tipografía en templates. **No es deuda directa:** el peso de fuente (`font-bold/semibold`) es legítimo en botones, headers y títulos, y no tiene una clase semántica que lo reemplace. La señal accionable son los _clusters repetidos_ (abajo).

| Categoría | Usos | Interpretación |
|-----------|------|----------------|
| Tamaño display (`text-4xl/3xl/2xl`) | 55 | Candidatas a `.kpi-value` o heading semántico |
| Peso de fuente (`font-bold/semibold`) | 1275 | Informativo — legítimo en botones/headers/títulos |

### Clusters repetidos (candidatos a clase semántica)

Combinaciones idénticas de utilidades (que incluyen tipografía) repetidas ≥5 veces → promover a una clase del DS:

| Repeticiones | Cluster |
|--------------|---------|
| 67 | `text-sm font-semibold text-text-primary` |
| 37 | `text-sm font-bold text-text-primary` |
| 31 | `text-xs font-semibold uppercase tracking-wide text-text-muted` |
| 17 | `text-lg font-semibold text-text-primary` |
| 16 | `text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted` |
| 14 | `text-base font-bold text-text-primary` |
| 14 | `text-[10px] font-bold text-text-muted uppercase tracking-wider` |
| 14 | `text-xs font-semibold text-text-primary` |
| 14 | `text-sm font-semibold truncate text-text-primary` |
| 14 | `text-xs font-semibold text-text-muted uppercase tracking-wider` |
| 14 | `text-xs font-bold text-text-muted uppercase tracking-widest` |
| 13 | `font-bold text-lg text-text-primary` |
| 13 | `text-base font-semibold text-text-primary` |
| 12 | `text-[10px] uppercase font-bold lg:hidden mb-1 text-text-muted` |
| 11 | `text-2xl font-semibold text-text-primary` |


<!-- AUTO-GENERATED:END -->
