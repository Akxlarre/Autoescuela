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
- **Spinner de carga (OBLIGATORIO):** `name="loader-circle"` + `class="animate-spin"` — es el único ícono de carga permitido (anillo con un segmento incompleto, fluido al rotar). **PROHIBIDO** `name="loader"` (rayos radiales tipo "estallido", poco legible en tamaños pequeños) — ni siquiera está registrado en `provideIcons()` (fix-065). `name="loader-2"` es un alias visualmente idéntico a `loader-circle` (Lucide lo renombró) — no hace falta migrar los usos existentes, pero usa `loader-circle` en código nuevo.

## Regla 3-2-1 de Marca (Brand Color Discipline)

El color de marca `var(--ds-brand)` debe aparecer en **máximo 3 elementos por viewport**:
- **2 interactivos** → CTAs primarios, links de acción, botones `.btn-primary`
- **1 decorativo** → borde de `.card-accent`, indicador de sección activa, o highlight visual

**PROHIBIDO:**
- Usar `var(--ds-brand)` en texto largo o de cuerpo
- Fondos de sección completos con el brand color (usar `.surface-hero` en su lugar)
- Más de 1 elemento puramente decorativo de marca por viewport

## Vocabulario tipográfico (OBLIGATORIO)

Cuatro clases cubren el 90% de la tipografía de la app. **Usarlas siempre en lugar de recomponer
utilities** — cada recomposición a mano es un punto de divergencia (fix-078-b encontró **221
overlines escritos a mano en 25 variantes distintas**, con 14 archivos mezclando varias entre sí).

| Clase | Qué es | Reemplaza a |
|---|---|---|
| `.kpi-value` | Número KPI principal | `text-4xl font-bold` |
| `.micro-label` | **Micro-label uppercase** — label de KPI, cabecera de grupo, título de columna, etiqueta de campo en lectura | `text-xs uppercase tracking-* font-* text-text-muted` |
| `.item-title` | Título de fila / card / ítem de lista | `text-sm font-semibold text-text-primary` |
| `.section-eyebrow` | Línea de contexto **legible** antes de un título (sin uppercase) | `text-sm text-text-secondary` |

```html
<!-- CORRECTO -->
<div class="card-tinted">
  <span class="micro-label">Usuarios activos</span>
  <span class="kpi-value">24.8K</span>
</div>

<!-- INCORRECTO -->
<div>
  <p class="text-xs text-gray-500 uppercase">Usuarios activos</p>
  <p class="text-4xl font-bold">24.8K</p>
</div>
```

> **`.kpi-label` es alias deprecado de `.micro-label`** (fix-078-b). Sigue funcionando; no usarla en
> código nuevo.
>
> ⚠️ **Hasta fix-078-b esta sección decía que `.kpi-label` era "SOLO para etiquetas de datos
> numéricos, NUNCA para contexto de sección".** Esa restricción fue la causa raíz de las 221
> instancias ad-hoc: quien necesitaba un micro-label fuera de un KPI tenía prohibida la única
> clase que hacía exactamente eso, así que la recomponía a mano. **`.micro-label` no tiene
> restricción de alcance** — es para cualquier micro-label en mayúsculas.
>
> ⚠️ **Se llamó `.overline` hasta fix-115-b.** `overline` es también el nombre de una utilidad
> nativa de Tailwind (`text-decoration-line: overline`) — usar ese literal como clase generaba
> una colisión silenciosa: Tailwind creaba su propia regla `.overline { text-decoration-line:
> overline }` en `@layer utilities`, que se sumaba (no reemplazaba) al estilo del DS, dibujando
> una línea física encima del texto en 141 lugares. Renombrado a `.micro-label` para eliminar la
> colisión de raíz. Ver ARCH-22 (`scripts/architect.js`) — guardrail que bloquea nombrar una
> clase del DS igual a una utilidad "bare" reservada de Tailwind.
>
> La distinción que **sí** importa es `.micro-label` (uppercase, micro, `text-muted`) vs
> `.section-eyebrow` (`text-sm`, natural, `text-secondary`): la primera etiqueta un dato, la
> segunda da contexto legible antes de un título.

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
<span class="indicator-live text-sm text-text-secondary">Sistema activo</span>
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
- **Estados vacíos y skeletons dentro de un `.bento-fill`** (2026-08-03): la celda puede medir "el resto del viewport" (500px+), mucho más que la card de altura natural que tenían antes. `app-empty-state` y skeletons van SIEMPRE en un wrapper `flex-1 flex items-center justify-center` para centrarse en el alto disponible en vez de quedar pegados arriba con un hueco vacío debajo. Regla proactiva, no reactiva — precedente: fix-078-b encontró 221 overlines ad-hoc por no fijar la regla de entrada.

### Trampas ya resueltas (no reinventar)

- **Switch de layout por CONTENEDOR, NO por `lg:` de Tailwind.** Usar `isDesktopLayout() = maxVisible() === null` (= tier desktop). Con `lg:` el rail/columnas no se apilan cuando un drawer angosta `<main>` (spec 0030).
- **Jerarquía por ancho, no por tamaño de fuente.** Si "se siente apretado", revisar qué panel es el protagonista (tabla ancha `flex-1` + rail angosto `<aside w-80>`) **antes** de achicar tipografías (spec 0030).
- **QA geométrico ≠ mirada humana.** 13/13 ACs verdes no garantizan que se vea bien; validar visualmente con `/verify`.
- **Nunca backticks dentro de comentarios de NINGÚN template literal del componente** — ni en
  `template:` ni en `styles: []`. Aplica igual a comentarios HTML (`<!-- -->`) y CSS (`/* */`):
  un backtick cierra el string antes de tiempo. **Regla práctica: si vas a nombrar una clase, un
  selector o una propiedad dentro de un comentario que vive en un backtick, escribilo sin
  comillas invertidas.** Síntoma que despista: `tsc` reporta errores de sintaxis en líneas que no
  tienen relación con lo que editaste, y `ng serve` puede seguir sirviendo un bundle stale en
  silencio.
  > Alcance ampliado tras dos incidentes en una misma sesión: el primero en `template:` y el
  > segundo en `styles: []`, porque la regla anterior solo nombraba `template` y se leyó como si
  > `styles` estuviera exento. El hazard es el backtick, no el campo del decorador.
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

### Cuándo NO aplica el patrón (excepción, no regla) — criterio formal (2026-08-02)

**App-like es el default de toda página de contenido enrutable** (excluye auth pre-shell e
impresión). "No aplica" es la **excepción**, y debe justificarse con al menos uno de estos 3
criterios — nunca con "es un formulario" o "es una página de detalle" como motivo genérico:

1. **Contenido genuinamente corto que nunca produce overflow.** El modificador no resuelve nada
   porque no hay scroll que evitar (ej. pantalla de resultado de pago, un formulario de una sola
   sección corta).
2. **El caso de uso real es mobile/tablet-first por el contexto físico de la tarea.** El patrón
   optimiza sesiones de escritorio; si la tarea casi nunca se hace en desktop (ej. instructor
   calificando dentro del vehículo), no aporta.
3. **No es una vista de navegación normal.** Hojas imprimibles (`@media print`, oculta el shell) o
   pantallas previas al shell autenticado.

**"Múltiples secciones secuenciales" NO es un criterio de exclusión válido por sí solo** — es la
señal de que la página necesita **reestructurarse en tabs** (patrón ya validado en Asistencia B:
Prácticas/Ciclos Teóricos) para que cada sección se vuelva su propio `.bento-fill`, **sin perder
ninguna funcionalidad existente**. Ejemplos típicos: fichas de detalle con secciones fijas
(matrículas, pagos, documentos, clases), páginas de configuración con múltiples bloques.

**Wizards con stepper tampoco quedan excluidos por defecto.** Ya existe precedente
(`secretaria-matricula.component.scss`) de un patrón full-height custom para wizards —
`:host { display: flex }` + `@container layoutmain (min-width: 1024px) { height: calc(100vh - Npx) }`,
fuera del canon `.bento-grid--fill-screen*` pero igual de "app-like" en espíritu. Replicar ese
patrón en otros wizards en vez de excluirlos por default.

Ver `indices/APP-LIKE-ROLLOUT.md` para el registro vivo de excepciones justificadas vs candidatas
pendientes de reestructurar.

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
