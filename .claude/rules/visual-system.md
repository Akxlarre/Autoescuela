# Sistema Visual

## Prioridad de UI

1. `indices/COMPONENTS.md` — ¿Existe algo reutilizable del Design System local?
2. `PrimeNG` — Para inputs complejos, tablas, calendarios, dropdowns
3. Componente custom — Solo si 1 y 2 no cubren la necesidad

## Tokens de color (PROHIBIDO hardcodear)

- Textos: `text-text-primary`, `text-text-secondary`, `text-text-muted` (el doble `text-` NO es typo: el token en `@theme` es `--color-text-*`. ⚠️ La forma corta `text-primary`/`text-secondary`/`text-muted` NO existe → Tailwind no genera CSS → el texto hereda el color del padre)
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

## Bento Grid (Arquitectura de Página)

- **Regla Root (OBLIGATORIO):** Todo Smart Component (página completa en `features/`) debe usar `.bento-grid` con la directiva `[appBentoGridLayout]` como **contenedor raíz** del template.
- **PROHIBIDO:** Usar `.page-wide`, `.page-content` o wrappers adicionales como raíz en los Smart Components. Estos shells son solo para páginas estáticas o stubs de legacy.
- **Jerarquía Plana:** Todos los bloques principales (`app-section-hero`, `kpis`, `tablas/listados`) deben ser **hijos directos** del `.bento-grid`.
- **PROHIBIDO:** Envolver el Hero o los KPIs en `divs` adicionales con márgenes manuales (`mb-6`, `mt-4`). El espaciado lo dicta el `gap` del grid.
- **Clases de Celda:**
    - `.bento-hero` → Para el `app-section-hero`.
    - `.bento-square` (o `.bento-1x1`) → Para `app-kpi-card` o mini-widgets.
    - `.bento-banner` (o `.bento-wide`) → Para tablas, listados o bloques de ancho completo.
- **Modificadores App-like (Desktop 100vh):** Usar `.bento-grid--fill-screen`, `--fill-screen-2` o `--fill-screen-kpi` en el contenedor `.bento-grid` para layouts que ocupan toda la pantalla en Desktop (lg+) y hacen scroll interno. En Mobile permiten scroll nativo. **⚠️ El modificador CSS es solo la mitad del patrón — leer la sección _Patrón App-like_ abajo antes de aplicarlo.**
- **GSAP:** El método `animateBentoGrid()` del `GsapAnimationsService` requiere que los hijos sean directos para que el stagger funcione correctamente.

```html
<!-- ✅ CORRECTO (Flat structure) -->
<div class="bento-grid" appBentoGridLayout>
  <app-section-hero class="bento-hero" ... />
  <div class="bento-square"> <app-kpi-card ... /> </div>
  <div class="bento-banner card"> <app-table ... /> </div>
</div>
```

- Solo **UN** `.card-accent` por sección bento (usualmente en la primera KPI o en el Hero).
- SCSS canónico: `src/styles/layout/_bento-grid.scss`

## Patrón App-like (fill-screen Desktop / scroll Mobile)

> Cuando en este proyecto se dice **"hazlo app-like"** significa **exactamente esto**, no una estética genérica de app.

**Definición:** la página ocupa **toda la pantalla (100vh) en Desktop (lg+) sin que el documento scrollee** — como una app de escritorio nativa. El overflow se resuelve con **scroll interno** dentro de los paneles (tabla, lista, rail), no moviendo la página. En **Mobile** revierte a **scroll nativo** normal. Peleado en specs 0028–0031.

### App-like son DOS pilares, no uno

Aplicar solo el modificador CSS produce una página que "llena la pantalla" pero **recorta o scrollea mal**. App-like **OBLIGA** a los dos pilares juntos:

1. **Shell fill-screen (CSS):** modificador en el `.bento-grid` raíz + la celda que crece marcada con `.bento-fill`.
2. **Densidad adaptativa (TS):** el contenido se **presupuesta** para caber en el alto fijo — nunca "se deja empujar".

### Pilar 1 — Shell (clases canónicas)

| Clase | Uso |
|---|---|
| `.bento-grid--fill-screen` / `--fill-screen-2` | Grid de pantalla completa (1 o 2 zonas de fill). |
| `.bento-grid--fill-screen-kpi` | Variante **hero + fila de KPIs + lista**. **Además** evita el _shift de tabs por el scrollbar de Windows_ (se aplica incondicional, sin `@if`). |
| `.bento-fill` | Celda que **crece y scrollea internamente**. Aplica `contain:size` **solo en lg+**. |

- **PROHIBIDO** `contain` o `min-height` **inline** en la celda — el canon vive en `.bento-fill`. Duplicarlo inline rompe el layout dual (spec 0028).
- **`flex`, no `grid`,** para las columnas internas: solo `flex` propaga el alto para que cada columna tenga su propio scroll (spec 0031).
- Un componente Angular que actúa como celda `.bento-fill` necesita `:host { display:flex; flex-direction:column; min-height:0 }` y el parent le pasa `class="bento-fill flex flex-col"`.

### Pilar 2 — Densidad adaptativa (medir por CONTENEDOR)

- `LayoutService.tier()` → signal `mobile | tablet | desktop` (umbrales 640/1024) alimentado por `observeMain(<main>)` (ResizeObserver, registrado una vez en `AppShellComponent`). Es **por contenedor**, no por viewport.
- `core/utils/layout-tier.utils.ts` → `widthToTier`, **`sliceByBudget`** (recorta N items al presupuesto de alto), `visibleWithLoadMore`, `LoadMoreState`.
- El Smart Component resuelve el presupuesto y lo pasa al Dumb como input (p. ej. `maxVisible: number | null`).

### Trampas ya resueltas (no reinventar)

- **Switch de layout por CONTENEDOR, NO por `lg:` de Tailwind.** Usar `isDesktopLayout() = maxVisible() === null` (= tier desktop). Con `lg:` el rail/columnas no se apilan cuando un drawer angosta `<main>` (spec 0030).
- **Jerarquía por ancho, no por tamaño de fuente.** Si "se siente apretado", revisar qué panel es el protagonista (tabla ancha `flex-1` + rail angosto `<aside w-80>`) **antes** de achicar tipografías (spec 0030).
- **QA geométrico ≠ mirada humana.** 13/13 ACs verdes no garantizan que se vea bien; validar visualmente con `/verify`.
- **Nunca backticks dentro de comentarios de un `template` literal** — rompen el build y `ng serve` sirve un bundle stale en silencio (spec 0030).
- **Nunca corchetes en un binding de clase** (`[class.flex-[2]]`) — rompen el binding (spec 0031).

### Ejemplo mínimo

```html
<!-- Smart Component raíz: shell fill-screen -->
<div class="bento-grid bento-grid--fill-screen-kpi" appBentoGridLayout>
  <app-section-hero class="bento-hero" ... />
  <div class="bento-square"> <app-kpi-card ... /> </div>

  <!-- celda que crece y scrollea internamente -->
  <app-mi-tabla-content
    class="bento-fill flex flex-col"
    [maxVisible]="budget()"        <!-- densidad: number en móvil, null en desktop -->
    [isDesktop]="isDesktopLayout()" />
</div>
```

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
