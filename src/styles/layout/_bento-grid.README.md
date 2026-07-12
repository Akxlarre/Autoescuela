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

Describen la **forma** de la celda. 

> **NUEVO (Container Queries):** El grid es 100% responsivo pero escucha al *ancho de su contenedor* (`@container layoutmain`), no de la pantalla. Esto asegura que si un panel lateral reduce el espacio disponible, el bento-grid reaccionará y adaptará sus columnas correctamente. El contenedor padre (ej. `<main>`) debe tener `style="container-type: inline-size; container-name: layoutmain;"`.

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

> ⚠️ **Trampa de capas:** los `@layer bento.*` se declaran DESPUÉS del
> `@layer utilities` de Tailwind, por lo que cualquier propiedad definida
> aquí le gana a la utility equivalente puesta en el mismo elemento
> (ej: un `min-h-[450px]` junto a `.bento-card` NO aplica donde
> `.bento-card` declare `min-height`). Antes de agregar propiedades de
> layout a `.bento-card`, considerar este efecto.

## Modo Dual: fill-screen desktop / scroll natural móvil (spec 0028)

El modo app-like (sin scroll de página) SOLO existe en desktop
(contenedor `layoutmain ≥ 1024px`). En móvil/tablet las celdas miden su
contenido y la página scrollea nativamente en `.shell-content`.

```html
<div class="bento-grid bento-grid--fill-screen" appBentoGridLayout>
  <app-section-hero />                        <!-- fila auto -->
  <div class="bento-banner card bento-fill">  <!-- llena el resto -->
    <!-- listas internas con overflow-y-auto + flex-1 min-h-0 -->
  </div>
</div>
```

Reglas:

1. `.bento-fill` va SOLO en la(s) celda(s) protagonista(s) de un grid
   `--fill-screen` / `--fill-screen-2`. En desktop recibe
   `contain: size; min-height: 0` (la fila `minmax(0,1fr)` dicta el alto);
   bajo 1024px no emite nada.
2. **PROHIBIDO** `style="contain: size"` o `min-height: NNNpx` inline en
   componentes — el modo dual vive únicamente en `_bento-grid.scss`.
3. NO aplicar `.bento-fill` (ni `contain`) al hero: su fila es `auto` y
   colapsaría.
4. Las listas internas scrollean solas en desktop (`overflow-y-auto` +
   `flex-1 min-h-0`); en móvil crecen naturalmente, y la densidad la
   recorta el componente con `sliceByBudget(items, budget)` +
   `LayoutService.tier()` (ver `core/utils/layout-tier.utils.ts`).
5. `min-height: 0` de `.bento-card` también está scoped a ≥1024px: bajo
   ese ancho las utilities `min-h-*` vuelven a funcionar (evitar usarlas
   para layout de celdas — preferir altura natural).

### Qué variante fill-screen usar

| Composición de la página | Modificador | Filas (lg+) | Ejemplo |
|---|---|---|---|
| Hero (con KPIs embebidos) + 1 card protagonista | `--fill-screen` | `auto minmax(0,1fr)` | Base Alumnos B, Comunicación Admin |
| Hero + 2 cards protagonistas lado a lado | `--fill-screen-2` | `auto minmax(0,1fr) minmax(0,1fr)` | Dashboard (Actividad + Alertas) |
| Hero + fila de KPIs **separada** (`.bento-square` × N) + 1 card protagonista | `--fill-screen-kpi` | `auto auto minmax(0,1fr)` | Comunicación Secretaria/Instructor (spec 0029) |

`--fill-screen-kpi` no necesita `data-row-start` ni wrapper divs: el hero
full-width agota la fila 1 (dense auto-flow empuja todo lo demás a la fila
2), las `.bento-square` no llenan las 12 columnas de la fila 2 pero tampoco
dejan hueco para una celda full-width, así que la card `.bento-fill` cae
sola a la fila 3.

### Checklist para migrar una página existente al modo dual

Receta completa, en orden. Referencias reales ya migradas (spec 0028):
`features/dashboard/dashboard.component.ts` (Smart, con densidad) y
`shared/components/alumnos-list-content/alumnos-list-content.component.ts`
(fill-screen sin densidad extra + "Cargar más").

1. **Quitar todo estilo inline de layout** en el Smart/Dumb de la página:
   `style="contain: size"`, `min-h-[NNNpx]`, y cualquier `@container` local
   duplicado que compensara el bug (buscar `dashboard-panel` o similar en
   el `styles:` del componente como ejemplo del patrón viejo a eliminar).
2. **Contenedor raíz** del grid: agregar el modificador fill-screen —
   `bento-grid--fill-screen` (una celda protagonista) o
   `bento-grid--fill-screen-2` (dos filas de celdas, como el dashboard).
3. **Celda(s) protagonista(s)**: agregar la clase `.bento-fill` junto a su
   clase de proporción (`bento-wide bento-card bento-fill`, etc.). El hero
   NUNCA lleva `.bento-fill`.
4. **(Opcional) Densidad adaptativa** — solo si la página tiene listas
   largas que deban recortarse en móvil:
   - Inyectar `LayoutService` (`core/services/ui/layout.service.ts`) en el
     Smart Component.
   - Derivar el presupuesto: `computed(() => layoutService.tier() === 'desktop' ? null : N)`
     (elegir `N` según cuántos ítems tienen sentido en una pantalla chica).
   - Recortar listas locales con `sliceByBudget(items(), budget())` de
     `core/utils/layout-tier.utils.ts`.
   - Si el recorte es de un Dumb Component hijo (no local), pasarle el
     presupuesto por `input()` (ver `maxItems` en `live-classes-panel`) —
     el Dumb sigue sin inyectar servicios.
   - Para listas "cargar más" en vez de "ver todas" (como la vista tarjetas
     de alumnos), usar un `signal` local de cuántos mostrar + botón que lo
     incrementa; resetear ese signal cuando cambien los filtros.
5. **Verificar** con `/verify` en 390×844 (sin scroll interno, sin celdas
   colapsadas) y 1440×900 (`.shell-content` sin scroll de página) — ambos
   en modo claro y oscuro. Si la página tiene drawer lateral, abrirlo y
   confirmar que la densidad reacciona sin recargar.

## Accesibilidad

- `grid-auto-flow: dense` puede desincronizar orden visual vs DOM
- `prefers-reduced-motion: reduce` desactiva animaciones automáticamente
- Verificar que el orden DOM coincida con el orden visual en layoutes complejos
