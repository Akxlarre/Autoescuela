---
name: design-system
description: >
  Sistema de diseño del proyecto: tokens, Frosted Cards, Bento Grid, modo claro/oscuro, GSAP.
  Activar SIEMPRE cuando se cree o modifique un componente Angular (.component.ts, .html),
  se trabaje en dashboard, cards, KPIs, layouts, o estilos.
  NUNCA usar text-pink-500, bg-blue-50, ni colores Tailwind arbitrarios.
  SIEMPRE usar var(--ds-brand), var(--color-primary), bg-surface, text-muted, bento-grid, card-tinted.
  Usar junto a angular-component y angular-signals.
user-invocable: false
allowed-tools: Read, Edit, Glob, Grep
---

# Design System — Referencia completa

Ver guía completa de tokens y componentes en [BRAND_GUIDELINES.md](BRAND_GUIDELINES.md).

## Stack técnico

- **Angular 20** — standalone components, signals, OnPush
- **Tailwind v4** — solo para spacing/layout base
- **SCSS + CSS Variables** — sistema de temas y Frosted Cards
- **GSAP 3** — todas las animaciones y transiciones de entrada

## Reglas absolutas

### Colores: siempre tokens

```scss
// INCORRECTO
color: #9B1D20;
background: bg-blue-500;

// CORRECTO
color: var(--color-primary);
background: var(--bg-surface);
```

### Fondos y superficies

- Página: `var(--bg-base)` (light: `#f4f4f5`, dark: `#09090b`)
- Cards/modales: `var(--bg-surface)`
- Modo dark: `[data-mode='dark']` en documentElement via `ThemeService`

### Todo componente usa OnPush

```typescript
@Component({ changeDetection: ChangeDetectionStrategy.OnPush })
```

### Radios mínimos

- Cards: `var(--radius-lg)` (14px) o mayor
- Botones: `var(--radius-full)` (pill)
- Chips/badges: `var(--radius-md)` (10px)

## Bento Grid

```html
<section class="bento-grid" [appBentoGridLayout] aria-label="Panel principal">
  <app-feature-card title="Dashboard" size="hero" [accent]="true" />
  @for (kpi of kpis(); track kpi.id) {
    <app-kpi-card [data]="kpi" />
  }
  <app-feature-card title="Section" size="2x2">
    <!-- contenido -->
  </app-feature-card>
</section>
```

| Clase | Descripción |
|---|---|
| `bento-square` | 1x1 normal |
| `bento-wide` | 2x1 ancho |
| `bento-tall` | 2x2 alto |
| `bento-feature` | 3x2 bloque grande |
| `bento-hero` | Full width superior |
| `bento-banner` | Full width cualquier posición |

**Regla**: Solo 1 `.card-accent` por sección bento.

## GSAP — Patrones de animación

```typescript
ngAfterViewInit(): void {
  const hero = this.host.nativeElement.querySelector<HTMLElement>('.bento-hero');
  if (hero) this.gsap.animateHero(hero);
  this.gsap.animateBentoGrid(this.grid().nativeElement);
}
```

Reglas GSAP:
- Siempre `clearProps: 'transform'` tras animaciones de movimiento
- Registrar plugins (`ScrollTrigger`, `Flip`) solo en browser (`isPlatformBrowser`)
- **No** usar `@angular/animations` en ningún componente
- Hover de cards con `addCardHover()`, no con CSS `transition`
- Contadores KPI con `animateCounter()` al entrar en viewport

## Iconos — Sistema Lucide

```html
<!-- OBLIGATORIO: siempre <app-icon>, nunca emojis ni SVG inline -->
<app-icon name="settings" />
<app-icon name="trending-up" [size]="20" />
<app-icon name="trash-2" [size]="16" color="var(--state-error)" />
```

| Input | Tipo | Default | Descripción |
|---|---|---|---|
| `name` | `string` (requerido) | — | Nombre kebab-case de lucide.dev |
| `size` | `number` | `16` | Tamaño en px (recomendados: 12, 14, 16, 18, 20, 24) |
| `color` | `string` | `'currentColor'` | Color CSS — hereda del padre |
| `ariaHidden` | `boolean` | `true` | false si el ícono tiene significado semántico propio |

**Íconos registrados por defecto** (set mínimo en `app.config.ts`):
- Boilerplate: `activity`, `alert-circle`, `arrow-right`, `bar-chart-2`, `check-circle`, `chevron-right`, `download`, `layout-dashboard`, `plus`, `settings`, `trending-down`, `trending-up`, `user`, `users`
- Shell support: `bell`, `log-out`, `menu`, `search`, `x`
- Acciones comunes: `check`, `edit`, `info`, `trash-2`

Para usar un ícono adicional: importarlo de `'lucide-angular'` con PascalCase y agregarlo al objeto `provideIcons()` en `app.config.ts`. Referencia completa: lucide.dev/icons

## Utilidades Semánticas — Nuevos Constructos

### KPI — Componente (OBLIGATORIO usar app-kpi-card)

```html
<!-- CORRECTO: usar el componente pre-construido -->
<app-kpi-card
  label="Usuarios activos"
  [value]="24819"
  [trend]="12.4"
  trendLabel="vs. mes anterior"
/>

<!-- Con prefix, suffix y accent (máx 1 accent por sección bento) -->
<app-kpi-card
  label="Ingresos del mes"
  [value]="84320"
  prefix="$"
  [trend]="-3.1"
  [accent]="true"
/>

<!-- Con skeleton mientras carga (patrón loading) -->
@if (facade.loading()) {
  <app-kpi-card-skeleton />
} @else {
  <app-kpi-card [value]="facade.revenue()" label="Ingresos" prefix="$" [appAnimateIn] />
}
```

**Inputs de app-kpi-card:**
| Input | Tipo | Default | Descripción |
|---|---|---|---|
| `value` | `number` (req) | — | Valor numérico animado desde 0 al montar |
| `label` | `string` (req) | — | Etiqueta descriptiva del KPI |
| `suffix` | `string` | `''` | Sufijo del valor (ej: `'%'`, `'K'`) |
| `prefix` | `string` | `''` | Prefijo del valor (ej: `'$'`, `'€'`) |
| `trend` | `number\|undefined` | `undefined` | Variación %. Positivo=verde↑, negativo=rojo↓ |
| `trendLabel` | `string` | `''` | Contexto del trend (ej: `'vs. mes anterior'`) |
| `accent` | `boolean` | `false` | Borde brand. Máx 1 por sección bento. |

**PROHIBIDO** recrear la composición KPI manualmente con `.kpi-value` y `.kpi-label` si `app-kpi-card` cubre la necesidad.
Las clases `.kpi-value` / `.kpi-label` solo se usan directamente en composiciones custom que no encajan en app-kpi-card.

### Empty State — Componente (OBLIGATORIO usar app-empty-state)

```html
<!-- Estado vacío mínimo -->
<app-empty-state message="No hay transacciones todavía." />

<!-- Con ícono, subtítulo y acción de recuperación -->
<app-empty-state
  icon="search"
  message="Sin resultados"
  subtitle="Intenta con otros términos de búsqueda."
  actionLabel="Limpiar filtros"
  actionIcon="x"
  (action)="resetFilters()"
/>

<!-- Vacío de sección con acción de creación -->
<app-empty-state
  icon="users"
  message="No tienes usuarios todavía"
  subtitle="Invita a tu equipo para empezar a colaborar."
  actionLabel="Invitar usuario"
  (action)="openInviteModal()"
/>
```

**PROHIBIDO** crear estados vacíos con texto plano o `<p>` aislados. Siempre `<app-empty-state>`.

### Alert Card — Componente (OBLIGATORIO usar app-alert-card)

```html
<!-- Info básica (default severity) -->
<app-alert-card title="Actualización disponible">
  Se publicó la versión 2.1 con mejoras de rendimiento.
</app-alert-card>

<!-- Error con acción de recuperación -->
<app-alert-card
  severity="error"
  title="No se pudo guardar"
  actionLabel="Reintentar"
  (action)="saveData()"
>
  Verifica tu conexión e inténtalo de nuevo.
</app-alert-card>

<!-- Éxito descartable -->
@if (showSuccess()) {
  <app-alert-card
    severity="success"
    title="Cambios guardados"
    [dismissible]="true"
    (dismissed)="showSuccess.set(false)"
  />
}

<!-- Warning con patrón loading-guard -->
@if (facade.quotaWarning()) {
  <app-alert-card severity="warning" title="Cuota al 85%">
    El equipo se acerca al límite del plan.
  </app-alert-card>
}
```

| Input | Tipo | Default | Descripción |
|---|---|---|---|
| `title` | `string` (req) | — | Título de la alerta (corto y accionable) |
| `severity` | `'error'\|'warning'\|'info'\|'success'` | `'info'` | Controla color, ícono y fondo |
| `actionLabel` | `string` | `undefined` | Texto del botón inline. Omitir = sin botón |
| `dismissible` | `boolean` | `false` | Muestra botón X de descarte |
| `(action)` | `output<void>` | — | Clic en botón de acción |
| `(dismissed)` | `output<void>` | — | Clic en botón de descarte |

**Body**: proyectado vía `<ng-content>` — no hay input de texto de cuerpo.
**PROHIBIDO** construir alertas con divs/spans ad-hoc coloreados. Siempre `<app-alert-card>`.

### Superficies

```html
<!-- surface-hero → banner principal, hero section -->
<section class="bento-hero surface-hero rounded-xl p-8">
  <h1 class="text-3xl font-bold">Bienvenido al Dashboard</h1>
</section>

<!-- surface-glass → overlays, panels flotantes -->
<div class="surface-glass rounded-lg p-4 fixed top-4 right-4">
  <p class="text-sm text-secondary">Panel de notificaciones</p>
</div>
```

### Indicadores de Actividad

```html
<!-- indicator-live → sistema activo, conexión real-time -->
<span class="indicator-live text-sm text-secondary">Sincronizado</span>

<!-- badge-pulse → badge con conteo de nuevos items -->
<span class="badge-pulse">
  <p-badge value="5" severity="danger" />
</span>
```

## Checklist antes de entregar un componente

- [ ] `ChangeDetectionStrategy.OnPush`
- [ ] Todos los colores son `var(--...)` — ningún hardcodeado
- [ ] Usa `.card`, `.card-accent` o `.card-tinted` según contexto
- [ ] 1 solo `.card-accent` por sección
- [ ] Iconos: `<app-icon>` — cero emojis ni SVG inline
- [ ] KPIs con `.kpi-value` + `.kpi-label` (no text-4xl plano)
- [ ] GSAP en `ngAfterViewInit` para entrada
- [ ] Funciona en modo claro y oscuro
- [ ] Contraste WCAG AA (mínimo 4.5:1 en texto normal)
- [ ] Radios respetan el sistema (`--radius-lg` mínimo en cards)
- [ ] Regla 3-2-1: máximo 3 elementos con brand color por viewport
