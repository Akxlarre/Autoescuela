# Bento Grid System v3

Sistema de layout tipo bento basado en CSS Grid con arquitectura de 3 capas.

## Quick Start

```html
<section appBentoGridLayout class="bento-grid">
  <div class="bento-wide bento-card">
    <div class="bento-card__body">Contenido wide</div>
  </div>
  <div class="bento-square bento-card">
    <div class="bento-card__body">Contenido square</div>
  </div>
  <div class="bento-tall bento-card">
    <div class="bento-card__body--center">Centrado vertical</div>
  </div>
</section>
```

## Clases de Proporción

Describen la **forma** de la celda. Responsive automático.

| Clase | Mobile (1col) | sm/640px (4col) | md/768px (8col) | lg/1024px (12col) |
|---|---|---|---|---|
| `bento-square` | full | 2 | 2 | 3 |
| `bento-wide` | full | 4 | 4 | 6 |
| `bento-tall` | full + 2 rows | 2 + 2r | 2 + 2r | 3 + 2r |
| `bento-feature` | full + 2 rows | 4 + 2r | 6 + 2r | 8 + 2r |
| `bento-hero` | full + 2 rows | full + 2r | full + 2r | full + 2r |
| `bento-banner` | full | full | full | full |

### Legacy Aliases

Compatibilidad con nomenclatura antigua. **Misma lógica**, sin duplicación:

| Alias | Equivale a |
|---|---|
| `bento-1x1` | `bento-square` |
| `bento-2x1`, `bento-3x1`, `bento-4x1` | `bento-wide` |
| `bento-2x2` | `bento-tall` |
| `bento-3x2` | `bento-feature` |

> **Recomendación**: usar nombres semánticos (`bento-wide`) en código nuevo.

## Data-Attributes (Placement Exacto)

Sobreescriben la clase de proporción cuando necesitas posición precisa.

```html
<!-- Celda anclada a columna 7, span 4 cols, 2 filas alto -->
<div class="bento-square"
     data-col-span="4"
     data-col-start="7"
     data-row-span="2">
```

### Disponibilidad por Breakpoint

| Atributo | md (768px+) | lg (1024px+) |
|---|---|---|
| `data-col-span-md="N"` | ✅ (1-8) | — |
| `data-col-start-md="N"` | ✅ (1-7) | — |
| `data-row-span-md="N"` | ✅ (1-4) | — |
| `data-col-span="N"` | — | ✅ (1-12) |
| `data-col-start="N"` | — | ✅ (1-11) |
| `data-row-span="N"` | — | ✅ (1-4) |

## Componentes Internos

### `.bento-card`

Componente visual con tokens del design system (theming automático light/dark):

```html
<div class="bento-wide bento-card">
  <div class="bento-card__body">Contenido</div>
</div>

<!-- Full-bleed image -->
<div class="bento-feature bento-card bento-card--flush">
  <div class="bento-media">
    <img src="hero.jpg" alt="Hero">
  </div>
  <div class="bento-card__body">Caption</div>
</div>
```

| Modificador | Efecto |
|---|---|
| `.bento-card--flush` | Sin padding (para imágenes full-bleed) |
| `.bento-card__body--bottom` | Alinea contenido abajo |
| `.bento-card__body--center` | Centra contenido vertical y horizontal |
| `.bento-card__body--spread` | Distribuye contenido con `space-between` |

### `.bento-media`

Utilidades para imágenes/video con `object-fit: cover`:

| Modificador | `object-position` |
|---|---|
| (default) | — |
| `.bento-media--top` | `top center` |
| `.bento-media--center` | `center` |
| `.bento-media--left` | `center left` |

## Tokens Personalizables

Los tokens están **scoped** dentro de `.bento-grid`. Override en un selector más específico:

```scss
.mi-dashboard .bento-grid {
  --bento-cols-lg: 6;      // 6 columnas en vez de 12
  --bento-gap-lg: var(--space-3);  // gap más compacto
  --bento-row-min: 80px;   // filas más bajas
}
```

## Animación de Reflow

Para animar cambios de layout (ej: paginación), usar la directiva `appBentoGridLayout`:

```html
<section appBentoGridLayout class="bento-grid">
  <!-- celdas -->
</section>
```

En componentes hijos que cambian tamaño:

```typescript
private layoutContext = inject(BENTO_GRID_LAYOUT_CONTEXT, { optional: true });

onPageChange(): void {
  this.layoutContext?.runLayoutChange(() => {
    this.rows.set(newRows);
  });
}
```

## Arquitectura CSS

```
@layer bento.grid          → Contenedor y tokens
@layer bento.proportions   → Clases de forma (square, wide, tall...)
@layer bento.placement     → data-attributes (siempre ganan)
@layer bento.components    → bento-card, bento-media
```

## Accesibilidad

- `grid-auto-flow: dense` puede desincronizar orden visual vs DOM
- `prefers-reduced-motion: reduce` desactiva animaciones automáticamente
- Verificar que el orden DOM coincida con el orden visual en layoutes complejos
