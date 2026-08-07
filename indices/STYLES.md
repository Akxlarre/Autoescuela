# Registro de Estilos & Design System

> **Regla de Actualización:** El Agente debe consultar esta tabla ANTES de crear estilos nuevos. Si ya existe una clase o token que resuelve la necesidad, **reutilizar**. Añadir a esta tabla cada vez que se cree un archivo de estilos nuevo.

## Fuentes de verdad del DS — jerarquía (fix-077-b)

El DS se documenta en cuatro lugares y **divergieron** hasta fix-077-b (la doc llegó a describir
una implementación de botones que ya no existía, y dos reglas se contradecían sobre skeletons).
Para que no vuelva a pasar, esta es la jerarquía; ante conflicto, gana el de más arriba:

| # | Fuente | Autoridad | Qué contiene |
|---|--------|-----------|--------------|
| 1 | **El código** (`_variables.scss`, `tailwind.css`) | 🥇 Definitiva | Los tokens y utilidades reales. Si la doc no coincide, **la doc está mal** |
| 2 | `.claude/rules/visual-system.md` + `architecture.md` | Normativa | Lo que *debés* hacer. Es lo que aplican los hooks |
| 3 | `indices/STYLES.md` (este archivo) | Registro | Qué existe y cómo se usa. Secciones `AUTO-GENERATED` se regeneran con `npm run indices:sync` |
| 4 | `~/.claude/skills/design-system/` + `docs/BRAND_GUIDELINES.md` | Didáctica | Material de enseñanza. **Deriva de 1-3, nunca define reglas propias** |

**Reglas de mantenimiento:**

- Si cambiás un token o una utilidad (nivel 1), actualizá el nivel 3 **en el mismo commit**.
  El desfase de fix-031-b→fix-077-b duró ~3 semanas justamente por saltarse esto.
- El nivel 4 **no debe reescribir** una regla del nivel 2: la cita y linkea. Una copia es una
  copia que se va a desactualizar.
- Antes de creerle a cualquier nivel 2-4, verificá contra el código si la afirmación es
  específica (un valor, un nombre de token, una garantía de comportamiento).

## Design Tokens

| Archivo | Responsabilidad | Ubicación | Estado |
|---------|----------------|-----------|--------|
| `_variables.scss` | Tokens del Design System (4 capas): escala (colores, espaciado, radios, tipografía, motion), semántica (superficies, texto, bordes, sombras, estados), marca (brand, gradientes, acciones), componentes (btn, input, card, motion). Light + Dark mode. Clases semánticas globales: `.kpi-value`, `.kpi-label`, `.section-eyebrow`, `.surface-hero`, `.surface-glass`, `.indicator-live`, `.badge-pulse`. | `styles/tokens/_variables.scss` | ✅ Estable |
| `_scrollbar.scss` | Styling minimalista y dinámico para scrollbars. Integrado con tokens. Solo desktop. | `styles/tokens/_scrollbar.scss` | ✅ Estable |


## Componentes (clases globales)

| Archivo | Responsabilidad | Ubicación | Estado |
|---------|----------------|-----------|--------|
| `_form-fields.scss` | **Fuente única** de los tokens de campo de formulario (form-ux §2): `.field-label`, `.field-input` (+ `:focus`, `::placeholder`, `--error`, `--valid`), `.field-hint`, `.field-error`, `.field-success`, `.section-title`. Reemplaza las copias locales que estaban duplicadas en ~20 componentes (fix-025-m). Clases globales (sin `@layer`) para ganar sobre `input,textarea` de styles.scss y los `@layer` de PrimeNG/Tailwind. Consúmelas junto al shell `app-drawer-form`. | `styles/components/_form-fields.scss` | ✅ Estable |


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

## Cómo elegir: bento + botones (árbol de decisión, fix-084-b)

La API de celdas bento y de botones creció por acumulación — 33 clases `.bento-*` y 9
variantes de `btn-*`, sin una respuesta obvia a "¿cuál uso?". Esto reemplaza el tener que
leer las 33/9 filas de referencia para decidir (esas tablas siguen abajo, para consulta
puntual de detalles).

**Bento — ¿qué celda uso?**

| Necesito | Clase |
|---|---|
| Header/hero de la página | `.bento-hero` |
| Card de ancho normal (1/3) | `.bento-square` |
| Card ancha (2/3) | `.bento-wide` |
| Card angosta pero alta (2 filas) | `.bento-tall` |
| Card ancha Y alta (2/3 × 2 filas) | `.bento-feature` |
| Tabla o listado (100% ancho) | `.bento-banner` |

**PROHIBIDO usar los alias dimensionales** (`bento-1x1`, `bento-2x1`, `bento-2x2`,
`bento-3x1`, `bento-3x2`, `bento-4x1`) **en código nuevo** — 0 usos reales en `src/app`
hoy, siguen existiendo solo por compatibilidad con código legacy que ya no está. Ver tabla
completa (auto-generada) más abajo, con cada alias marcado `⚠️ Legacy`.

**Botones — ¿qué `btn-*` uso?**

| Necesito | Clase |
|---|---|
| CTA principal de la sección | `btn-primary` |
| Acción secundaria estándar | `btn-secondary` |
| Acción terciaria discreta (fila de tabla, lista) | `btn-ghost` |
| Confirmar una acción positiva (ej. "Completar") | `btn-success-soft` |
| Transición a estado de alerta (ej. "Iniciar") | `btn-warning-soft` |
| Acción destructiva en un hero/cabecera | `btn-danger-ghost` |
| Confirmar una acción destructiva (modal) | `btn-danger-solid` |
| Botón más chico — componer con cualquiera de arriba | agregar `btn-sm` |

`btn-outline`/`btn-neutral` son de uso puntual (paginación, cancelar-en-modal
respectivamente) — ver la tabla de detalle si ninguna fila de arriba encaja.

## Component Utility Classes (`tailwind.css`)

Clases de botón definidas con `@utility` en `src/tailwind.css`. Usar SIEMPRE estas clases en lugar de componer Tailwind ad-hoc.

| Clase | Apariencia | Cuándo usar |
|-------|-----------|-------------|
| `btn-primary` | Fondo brand, texto blanco. `:disabled` → fondo `--bg-subtle`, texto `--text-muted`, sin sombra (hotfix-005-m) — visualmente gris neutro para máximo contraste vs estado habilitado. Dentro de `surface-hero` se invierte (blanco + brand text) por cascade. **NO agregar `[style.opacity]` o `[style.cursor]` inline — el `:disabled` CSS los maneja.** | CTA principal de la sección |
| `btn-secondary` | Borde sutil, fondo translúcido. **Afectado por cascade `surface-hero`** → glass blanco. | Acción secundaria estándar |
| `btn-ghost` | Sin borde, fondo transparente. Hover: `bg-subtle` + texto sube a `text-primary`. Tokens `--btn-ghost-*`. | Acción terciaria discreta (filas de tabla, listas) |
| `btn-warning-soft` | Fondo `--state-warning-bg`, texto `--state-warning`, borde `--state-warning-border`. Dark-mode aware vía tokens. | Acción de transición de estado warning (ej: "Iniciar") |
| `btn-success-soft` | Fondo `--state-success-bg`, texto `--state-success`, borde `--state-success-border`. Dark-mode aware vía tokens. | Acción de confirmación positiva (ej: "Completar") |
| `btn-danger-ghost` | Fondo `--bg-surface`, borde `--state-error-border`, texto `--state-error`. Hover: `--state-error-bg`. Dark-mode aware vía tokens. **Inmune al cascade de `surface-hero`** (ver nota abajo). | Acción destructiva en heroes/cabeceras |
| `btn-danger-solid` | Fondo `--state-error-strong`, texto `--color-primary-text`. Hover: `--state-error-strong-hover`. Padding ligeramente mayor (`py-2.5 px-5`). **Inmune al cascade.** ⚠️ `--state-error-strong` **no se redefine en dark** (queda `#dc2626` en ambos modos) — es deliberado: un confirm destructivo mantiene el rojo saturado, y blanco sobre `#dc2626` cumple AA. No "arreglarlo" sin leer esto. | Confirmación de acción destructiva (modales) |
| `btn-neutral` | Fondo `--bg-subtle`, texto `--text-primary`. Hover: `filter: brightness(0.96)`. Padding igual que `btn-danger-solid`. ⚠️ **NO es inmune al cascade** — ver nota. | Cancelar/cerrar en modales |
| `btn-outline` | Borde `--border-muted`, fondo `--bg-surface`, texto `--text-primary`. Hover: `--bg-elevated`. `:disabled` → opacity 0.4 + cursor not-allowed via CSS. Dark-mode aware vía tokens. | Botones secundarios de paginación, acciones de peso medio |

> **Nota cascade** (corregida en fix-077-b — la versión anterior de esta nota describía una
> implementación que dejó de existir en `fix-031-m`):
>
> **Todos** los `btn-*` son hoy `var(--)` tokens; ninguno usa `theme()`. La inmunidad al cascade
> de `.surface-hero` no viene del mecanismo del valor, sino de **cuáles** tokens sobrescribe el
> hero — y hoy sobrescribe exactamente 22 declaraciones (ver §"Token Cascade en `.surface-hero`").
>
> | Utilidad | ¿Inmune a `.surface-hero`? | Por qué |
> |---|---|---|
> | `btn-danger-ghost` | ✅ Sí | Depende de `--bg-surface` y `--state-error*`, que el hero **no** toca |
> | `btn-danger-solid` | ✅ Sí | Depende de `--state-error-strong`, que el hero **no** toca |
> | `btn-neutral` | ❌ **No** | Depende de `--bg-subtle` y `--text-primary`, y el hero **sobrescribe ambos** → dentro de un hero renderiza como glass blanco con texto blanco |
>
> ⚠️ **La inmunidad de los dos primeros es incidental, no un contrato.** Nadie la declaró: se
> sostiene solo mientras `.surface-hero` no agregue `--bg-surface` o `--state-error*` a su lista
> de overrides. Si necesitas la garantía de verdad, hay que darle tokens propios que no deriven
> de la capa semántica — hoy no existe tal botón.
>
> **Para "cancelar" dentro de un hero, `btn-neutral` es la elección incorrecta.** Usar
> `btn-secondary`, que el hero adapta a glass blanco *a propósito*.

**Modificador de tamaño — `btn-sm`** (fix-086-m/ASG-b-008): componible con **cualquiera** de los
`btn-*` de arriba (`class="btn-primary btn-sm"`, `class="btn-ghost btn-sm"`, etc.) — no crea
variantes por tipo (`btn-primary-sm` no existe). Aplica `padding: 0.375rem 0.75rem; gap: 0.375rem;
font-size: var(--text-xs)`. **Declarado en `src/tailwind.css` DESPUÉS de todas las utilities `btn-*`
base** — necesario para ganar la cascada (misma especificidad de clase única). **PROHIBIDO** seguir
mutilando `btn-*` a mano con `text-xs`/`px-*`/`py-*`/`rounded-*` sueltos (ARCH-16/AP-013) — usar
`btn-sm` para cualquier botón compacto nuevo.

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
| `.overline` | Micro-label uppercase — `text-xs`, `font-semibold`, `letter-spacing: 0.06em`, muted | **Cualquier** micro-label en mayúsculas: label de KPI, cabecera de grupo, título de columna, etiqueta de campo en lectura |
| `.kpi-label` | ⚠️ **Alias deprecado de `.overline`** (fix-078-b) | Sigue funcionando por compatibilidad. No usar en código nuevo |
| `.item-title` | Título de fila/card/ítem — `text-sm`, `font-semibold`, `text-primary`, `leading-snug` | Título de una fila de tabla, card o ítem de lista |
| `.section-eyebrow` | Línea de contexto pre-título — `text-sm`, `font-medium`, color secondary, sin uppercase | `contextLine` en `app-section-hero`, cabeceras de sección, breadcrumb textual |
| `.surface-hero` | Superficie gradient (sky→indigo→violet) con glow overlay | Banners, `app-section-hero` variant full, CTAs de alta jerarquía |
| `.surface-glass` | Overlay glass con backdrop-blur | Modales flotantes, panels, tooltips ricos |
| `.indicator-live` | Dot verde pulsante — sistema activo / conexión online | Indicadores de estado en tiempo real |
| `.badge-pulse` | Badge con pulso de atención | Conteos sin leer, alertas nuevas |

> **⚠️ Distinción clave:** `.overline` ≠ `.section-eyebrow`. La primera es un micro-label en
> mayúsculas que **etiqueta** algo (un dato, una columna, un grupo). La segunda es texto de
> contexto **legible** antes de un título (`text-sm`, sin uppercase, `text-secondary`).
>
> Antes esta nota separaba `.kpi-label` de `.section-eyebrow` y la regla era "kpi-label solo para
> datos numéricos". Esa restricción de alcance fue la causa raíz de 221 overlines ad-hoc en 25
> variantes (fix-078-b) — quien necesitaba un micro-label fuera de un KPI lo recomponía a mano.

## Campos de Formulario (`styles/components/_form-fields.scss`)

Fuente única de verdad para los campos de formulario (drawers/modales/páginas). Definidas globalmente (fix-025-m / form-ux §2). **PROHIBIDO** redefinirlas localmente en el `styles:` de un componente — antes estaban duplicadas en ~20 componentes.

| Clase | Propósito |
|-------|-----------|
| `.section-title` | Título de sección de formulario — `text-sm`, weight 600, border-bottom |
| `.field-label` | Etiqueta de campo — `text-sm`, weight 500, `text-primary` |
| `.field-input` | Input/textarea/select base — `bg-base`, `radius-md`, focus ring `--ds-brand`. Usar `.resize-none` extra en textareas |
| `.field-input--error` / `.field-input--valid` | Borde de estado (rojo / verde) según validación |
| `.field-hint` | Texto de ayuda contextual — `12px`, muted |
| `.field-error` / `.field-success` | Mensaje de validación — `12px`, color de estado |

> Consumidas por el shell `app-drawer-form` y todos los drawers/formularios migrados. Un cambio aquí se propaga a toda la app.

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
| `--ds-brand` | 439 | `#38bdf8` |
| `--text-muted` | 404 | `rgba(255, 255, 255, 0.55)` |
| `--text-primary` | 265 | `var(--color-primary-text)` |
| `--text-secondary` | 231 | `rgba(255, 255, 255, 0.78)` |
| `--border-subtle` | 218 | `rgba(255, 255, 255, 0.18)` |
| `--state-error` | 215 | `#f87171` |
| `--bg-surface` | 195 | `#18181b` |
| `--state-success` | 176 | `#4ade80` |
| `--color-primary` | 148 | `#38bdf8` |
| `--border-default` | 133 | `rgba(255, 255, 255, 0.28)` |
| `--state-warning` | 128 | `#fbbf24` |
| `--bg-elevated` | 80 | `#27272a` |
| `--text-sm` | 66 | `0.875rem` |
| `--bg-subtle` | 64 | `rgba(255, 255, 255, 0.1)` |
| `--duration-fast` | 59 | `200ms` |
| `--radius-md` | 58 | `10px` |
| `--font-display` | 53 | `'Bricolage Grotesque', system-ui, sans-serif` |
| `--border-muted` | 50 | `var(--border-subtle)` |
| `--color-primary-muted` | 48 | `rgba(56, 189, 248, 0.15)` |
| `--text-xs` | 47 | `0.75rem` |
| `--bg-base` | 47 | `#09090b` |
| `--color-primary-text` | 41 | `#ffffff` |
| `--color-success` | 39 | `—` |
| `--state-error-bg` | 25 | `rgba(248, 113, 113, 0.1)` |
| `--state-success-bg` | 25 | `rgba(74, 222, 128, 0.1)` |

## Clases semánticas del Design System

| Clase | Usos en templates | Archivo |
|-------|------------------|---------|
| `.card` | 234 | `src/styles/tokens/_variables.scss` |
| `.item-title` | 165 | `src/styles/tokens/_variables.scss` |
| `.overline` | 130 | `src/styles/tokens/_variables.scss` |
| `.kpi-label` | 25 | `src/styles/tokens/_variables.scss` |
| `.kpi-value` | 15 | `src/styles/tokens/_variables.scss` |
| `.surface-glass` | 12 | `src/styles/tokens/_variables.scss` |
| `.card-tinted` | 12 | `src/styles/tokens/_variables.scss` |
| `.card-accent` | 7 | `src/styles/tokens/_variables.scss` |
| `.indicator-live` | 5 | `src/styles/tokens/_variables.scss` |
| `.surface-hero` | 4 | `src/styles/tokens/_variables.scss` |
| `.badge-pulse` | 3 | `src/styles/tokens/_variables.scss` |
| `.section-eyebrow` | 1 | `src/styles/tokens/_variables.scss` |

## Bento Grid — Clases de celda disponibles

| Clase CSS | Proporción |
|-----------|-----------|
| `.bento-1x1` | ⚠️ Legacy — usar `.bento-square` |
| `.bento-2x1` | ⚠️ Legacy — usar `.bento-wide` |
| `.bento-2x2` | ⚠️ Legacy — usar `.bento-tall` |
| `.bento-3x1` | ⚠️ Legacy — usar `.bento-wide` |
| `.bento-3x2` | ⚠️ Legacy — usar `.bento-feature` |
| `.bento-4x1` | ⚠️ Legacy — usar `.bento-wide` |
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
| `.bento-fill` | — |
| `.bento-grid` | Contenedor raíz (con [appBentoGridLayout]) |
| `.bento-grid--fill-screen` | — |
| `.bento-grid--fill-screen-2` | — |
| `.bento-grid--fill-screen-kpi` | — |
| `.bento-grid--forms` | — |
| `.bento-grid--four-equal` | — |
| `.bento-grid--hero-fit` | — |
| `.bento-grid--rows-fit` | — |
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
| **dialog** | `.p-dialog` · `.p-dialog-close-button` · `.p-dialog-content` · `.p-dialog-footer` · `.p-dialog-header` +3 |
| **disabled** | `.p-disabled` |
| **dropdown** | `.p-dropdown-item` · `.p-dropdown-items` |
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
| **select** | `.p-select` · `.p-select-filter` · `.p-select-filter-container` · `.p-select-item` · `.p-select-item-focus` +8 |
| **skeleton** | `.p-skeleton` |
| **sortable** | `.p-sortable-column` |
| **step** | `.p-step` · `.p-step-header` · `.p-step-number` · `.p-step-title` |
| **steplist** | `.p-steplist` |
| **steppanel** | `.p-steppanel` · `.p-steppanel-content` · `.p-steppanel-content-wrapper` |
| **steppanels** | `.p-steppanels` |
| **stepper** | `.p-stepper` · `.p-stepper-nav` · `.p-stepper-separator` |
| **tab** | `.p-tab` · `.p-tab-active` |
| **tablist** | `.p-tablist` |
| **tabpanel** | `.p-tabpanel` |
| **tabs** | `.p-tabs` |
| **toast** | `.p-toast` · `.p-toast-close-button` · `.p-toast-close-icon` · `.p-toast-detail` · `.p-toast-message` +11 |
| **togglebutton** | `.p-togglebutton` · `.p-togglebutton-checked` |
| **toggleswitch** | `.p-toggleswitch` · `.p-toggleswitch-checked` · `.p-toggleswitch-handle` · `.p-toggleswitch-input` · `.p-toggleswitch-slider` |
| **tooltip** | `.p-tooltip` · `.p-tooltip-arrow` · `.p-tooltip-bottom` · `.p-tooltip-left` · `.p-tooltip-right` +2 |
| **yearpicker** | `.p-yearpicker-year` |

## Tipografía — drift de utilidades

> Conteo crudo de utilidades de tipografía en templates. **No es deuda directa:** el peso de fuente (`font-bold/semibold`) es legítimo en botones, headers y títulos, y no tiene una clase semántica que lo reemplace. La señal accionable son los _clusters repetidos_ (abajo).

| Categoría | Usos | Interpretación |
|-----------|------|----------------|
| Tamaño display (`text-4xl/3xl/2xl`) | 54 | Candidatas a `.kpi-value` o heading semántico |
| Peso de fuente (`font-bold/semibold`) | 920 | Informativo — legítimo en botones/headers/títulos |

### Clusters repetidos (candidatos a clase semántica)

Combinaciones idénticas de utilidades (que incluyen tipografía) repetidas ≥5 veces → promover a una clase del DS:

| Repeticiones | Cluster |
|--------------|---------|
| 15 | `text-2xs font-bold text-text-muted uppercase tracking-wider` |
| 13 | `font-bold text-lg text-text-primary` |
| 12 | `text-xs font-semibold text-text-primary` |
| 12 | `text-2xs uppercase font-bold lg:hidden mb-1 text-text-muted` |
| 12 | `text-xs font-bold text-text-muted uppercase tracking-widest` |
| 11 | `text-2xl font-semibold text-text-primary` |
| 10 | `text-sm font-bold text-warning` |
| 10 | `text-text-muted mb-0.5 uppercase tracking-tighter font-bold` |
| 10 | `text-lg font-semibold text-text-primary` |
| 10 | `text-sm font-bold text-text-primary` |
| 9 | `m-0 font-semibold text-text-primary` |
| 8 | `text-xs font-semibold uppercase tracking-wider` |
| 6 | `text-xs font-bold uppercase tracking-wider text-text-primary` |
| 6 | `text-text-secondary font-semibold text-xs tracking-wider` |
| 5 | `w-9 h-9 rounded-full bg-elevated flex items-center justify-center border border-border-subtle text-text-secondary font-bold text-xs uppercase` |


<!-- AUTO-GENERATED:END -->
