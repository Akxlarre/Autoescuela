# Sistema Visual

## Prioridad de UI

1. `indices/COMPONENTS.md` — ¿Existe algo reutilizable del Design System local?
2. `PrimeNG` — Para inputs complejos, tablas, calendarios, dropdowns
3. Componente custom — Solo si 1 y 2 no cubren la necesidad

## Tokens de color (PROHIBIDO hardcodear)

- Textos: `text-primary`, `text-secondary`, `text-muted`
- Fondos: `bg-base` (página), `bg-surface` (cards), `bg-surface-elevated`
- Marca: `var(--ds-brand)`, `var(--color-primary)`
- **NUNCA**: `text-red-500`, `bg-[#ff0000]`, u otras utilities de colores arbitrarios de Tailwind. Usa siempre variables abstractas.

## Iconos — Sistema Lucide (OBLIGATORIO)

- **PROHIBIDO** usar emojis como iconos de UI (❌ `✅`, `⚠️`, `🔒`, `📊`)
- **OBLIGATORIO** usar `<app-icon name="..." />` para todo ícono de interfaz
- Selector: `app-icon` | inputs: `name` (requerido), `size` (default 16), `color`, `ariaHidden`
- Nombres en kebab-case igual que en lucide.dev (ej: `"trending-up"`, `"trash-2"`)
- Para agregar un ícono nuevo: importarlo de `'lucide-angular'` y registrarlo en `provideIcons()` en `app.config.ts`
- **NUNCA** insertar `<svg>` inline ad-hoc — siempre pasar por `<app-icon>`

## Regla 3-2-1 de Marca (Brand Color Discipline)

El color de marca `var(--ds-brand)` debe aparecer en **máximo 3 elementos por viewport**:
- **2 interactivos** → CTAs primarios, links de acción, botones `.btn-primary`
- **1 decorativo** → borde de `.card-accent`, indicador de sección activa, o highlight visual

**PROHIBIDO:**
- Usar `var(--ds-brand)` en texto largo o de cuerpo
- Fondos de sección completos con el brand color (usar `.surface-hero` en su lugar)
- Más de 1 elemento puramente decorativo de marca por viewport

## Tipografía de Datos — KPI (OBLIGATORIO)

En componentes con datos numéricos (KPIs, métricas, estadísticas):
- **OBLIGATORIO** `.kpi-value` para el número principal (reemplaza `text-4xl font-bold`)
- **OBLIGATORIO** `.kpi-label` para la etiqueta descriptiva (reemplaza `text-xs uppercase`)
- Combinar con `.card-tinted` para máximo contraste visual

```html
<!-- CORRECTO -->
<div class="card-tinted">
  <span class="kpi-label">Usuarios activos</span>
  <span class="kpi-value">24.8K</span>
</div>

<!-- INCORRECTO -->
<div>
  <p class="text-xs text-gray-500 uppercase">Usuarios activos</p>
  <p class="text-4xl font-bold">24.8K</p>
</div>
```

## Superficies Activas (OBLIGATORIO)

- **`.surface-hero`** → banners, hero sections, headers de alta jerarquía. Aplica `var(--gradient-hero)`. El texto SIEMPRE en `var(--color-primary-text)` (blanco).
- **`.surface-glass`** → modales flotantes, overlays, panels glassmorphism. Usa backdrop-filter blur automático.

```html
<!-- Hero section con superficie de marca -->
<section class="bento-hero surface-hero rounded-xl">
  <h1>Dashboard</h1>
</section>

<!-- Panel flotante con glass -->
<div class="surface-glass rounded-lg p-4">
  <!-- contenido de overlay -->
</div>
```

## Indicadores de Actividad

- **`.indicator-live`** → dot verde pulsante para sistemas activos / conexiones en tiempo real
- **`.badge-pulse`** → pulso de atención en badges de conteo (nuevos items, alertas no leídas)

```html
<span class="indicator-live text-sm text-secondary">Sistema activo</span>
<span class="badge-pulse">
  <p-badge value="3" severity="danger" />
</span>
```

## Skeletons y Estados de Carga (OBLIGATORIO)

El proyecto utiliza un patrón estricto de **Single-Component Skeleton** para evitar deuda técnica y Layout Shift térmico (CLS).

- **PROHIBIDO** crear componentes duplicados tipo `*-skeleton.component.ts` (ej: `kpi-card-skeleton.component.ts`).
- **OBLIGATORIO** manejar el estado dentro del mismo componente: todo componente que cargue datos debe aceptar un input numérico/booleano `loading` y resolver el skeleton internamente usando un bloque `@if (loading())`.
- **OBLIGATORIO** usar `<app-skeleton-block>` para los placeholders. Este componente usa `GsapAnimationsService.createShimmer()` automáticamente. No usar CSS `@keyframes` para los brillos.

```html
<!-- CORRECTO (Dentro del mismo app-feature.component.ts) -->
@if (loading()) {
  <app-skeleton-block variant="text" width="100%" height="20px" />
} @else {
  <p>{{ data().title }}</p>
}
```

## Bento Grid

- Contenedor: `.bento-grid` + directiva `[appBentoGridLayout]`
- Hijos: `.bento-square`, `.bento-wide`, `.bento-tall`, `.bento-feature`, `.bento-hero`
- Solo **UN** `.card-accent` por sección bento
- SCSS canónico: `src/styles/layout/_bento-grid.scss`

## Cards

- `.card` — base con borde y padding estándar
- `.card-accent` — borde superior con `var(--ds-brand)` (1 por sección)
- `.card-tinted` — fondo primario diluido (para KPIs y highlights)

## Modo claro/oscuro

- Controlado por `ThemeService` con `[data-mode='dark']` en el documentElement
- `this.themeService.setColorMode('dark' | 'light' | 'system')`
- PrimeNG: usar `darkModeSelector: '.fake-dark-mode'` para evitar conflictos

## Animaciones y Motion Physics (GSAP obligatorio)

- **PROHIBIDO** `@angular/animations` ni CSS `@keyframes` para entradas de vistas.
- **PERMITIDO** CSS `@keyframes` SOLO para animaciones de estado continuo (loops como `.indicator-live`, `.badge-pulse`).
- **PROHIBIDO** inventar `durations` o `eases` arbitrarios en GSAP. Usa variables CSS (`--duration-*`, `--ease-*`).
- **OBLIGATORIO** `GsapAnimationsService` en `ngAfterViewInit`
- Métodos clave: `animateBentoGrid()`, `animateHero()`, `animateCounter()`, `addCardHover()`
- Siempre `clearProps: 'transform'` tras animaciones de movimiento
