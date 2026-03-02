# Brand Guidelines y Theming

> NUNCA usar colores Tailwind arbitrarios hardcodeados (`text-pink-500`, `bg-[#ff0000]`). SIEMPRE usar Tokens.

## Tokens tipográficos

| Token | Uso |
|---|---|
| `text-primary` | Títulos grandes y legibles |
| `text-secondary` | Subtítulos y descripciones |
| `text-muted` | Timestamps, placeholders, info secundaria |

## Tokens de superficie

| Token | Uso |
|---|---|
| `bg-base` | Fondo general (fuera del card) |
| `bg-surface` | Background de componentes internos |
| `var(--ds-brand)` | Color de marca principal |
| `var(--color-primary)` | Color primario del sistema |
| `var(--color-primary-muted)` | Versión diluida del primario |

## Cards y superficies

| Clase | Comportamiento |
|---|---|
| `.card` | Base con bordes y padding estándar |
| `.card-accent` | Borde superior con `var(--ds-brand)` |
| `.card-tinted` | Fondo `color-mix(in srgb, var(--ds-brand) 4%, ...)` |

**Regla Canónica**: Solo puede haber **UN solo elemento `.card-accent`** por sección bento grid.

## Bento Grid

Columnas: `1 → 4 → 8 → 12` (mobile-first, breakpoints 640/768/1024px)

| Clase | Mobile | sm (4) | md (8) | lg (12) |
|---|---|---|---|---|
| `bento-square` | full | 2 | 2 | 3 |
| `bento-wide` | full | 4 | 4 | 6 |
| `bento-tall` | full+2r | 2+2r | 2+2r | 3+2r |
| `bento-feature` | full+2r | 4+2r | 6+2r | 8+2r |
| `bento-hero` | 1/-1+2r | 1/-1+2r | 1/-1+2r | 1/-1+2r |

**Placement exacto (1024px+)**: `data-col-span`, `data-col-start`, `data-row-span`

SCSS canónico: `src/styles/layout/_bento-grid.scss`

## Radios

- Cards y contenedores: `var(--radius-lg)` (14px) o mayor
- Botones: `var(--radius-full)` (pill)
- Chips/badges: `var(--radius-md)` (10px)

## Sistema de Iconos — Lucide

Todos los iconos de la UI se implementan con el wrapper `<app-icon>`:

- **Stroke-width 2px fijo** con `absoluteStrokeWidth: true` — no escala con el size
- **currentColor** por defecto — hereda el color del elemento padre
- **aria-hidden="true"** por defecto — decorativos. Usar `[ariaHidden]="false"` + `ariaLabel` para iconos con significado

```html
<!-- Ícono básico -->
<app-icon name="settings" />

<!-- Con tamaño y en botón accesible -->
<button aria-label="Eliminar registro">
  <app-icon name="trash-2" [size]="16" />
</button>

<!-- Con color semántico de estado -->
<app-icon name="check-circle" [size]="20" color="var(--state-success)" />
```

**Tamaños recomendados por contexto:**
| Contexto | Size |
|---|---|
| Inline en texto de cuerpo | 14–16px |
| Botones de acción | 16px |
| Iconos de navegación | 18–20px |
| Hero / Ilustrativos | 24px+ |

## Anatomía de un KPI

Los datos numéricos siguen una jerarquía tipográfica explícita:

```
┌──────────────────────────────┐
│  .kpi-label                  │   ← xs, uppercase, text-muted
│  USUARIOS ACTIVOS            │
│                              │
│  .kpi-value                  │   ← 4xl, bold, tight, tabular-nums
│  24,819                      │
│                              │
│  ▲ +12.4%  (state-success)  │   ← sm, flex, app-icon + span
└──────────────────────────────┘
```

**Combinar siempre con**: `.card-tinted` (fondo) + `animateCounter()` de GSAP al entrar en viewport.

## Jerarquía de Superficies

```
bg-base (página)
  └── bg-surface (card/modal)
        └── bg-elevated (hover, filas)
              └── bg-subtle (inputs, chips)

Superficies especiales:
  surface-hero  → gradiente de marca (alta jerarquía)
  surface-glass → glass morphism (overlays flotantes)
```

**Regla**: Solo UNA `surface-hero` por vista. No anidar dos superficies de marca.

## Indicadores de Actividad

| Clase | Uso | Animación |
|---|---|---|
| `.indicator-live` | Sistema online, conexión real-time activa | Pulse ring verde continuo |
| `.badge-pulse` | Contador sin leer, alertas nuevas | Pop elástico periódico |

**GSAP vs CSS loops**: Entradas de vistas → GSAP siempre. Loops de estado continuo (como estos indicadores) → CSS keyframes (ya incluidos en el design system).

## Animaciones GSAP

- **NUNCA** CSS `@keyframes` para entradas de vistas
- **SÍ** CSS `@keyframes` para loops de estado continuo (`.indicator-live`, `.badge-pulse`)
- Inyectar `GsapAnimationsService` en `ngAfterViewInit`
- Métodos disponibles:
  - `animateBentoGrid(containerEl)` — stagger de celdas
  - `animateHero(el)` — entrada con blur + scale
  - `animateCounter(el, target, suffix)` — contador KPI (usar con `.kpi-value`)
  - `addCardHover(el)` — sombra elevada en hover
  - `animateThemeChange(onSwap)` — transición de tema
  - `animatePageEnter(el)` / `animatePageLeave(el, onComplete)` — route transitions

## Regla 3-2-1 de Marca

`var(--ds-brand)` aparece en máximo **3 elementos por viewport**:
- 2 interactivos (botones primary, links de acción)
- 1 decorativo (`.card-accent`, indicador de sección activa)

No usar brand color en texto de cuerpo, fondos de sección completos, ni más de 1 elemento decorativo.
