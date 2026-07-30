# Plan 0028-b — Layout responsive dual: fill-screen desktop / scroll natural móvil + densidad adaptativa

> **Spec:** [spec.md](./spec.md)
> **Status:** approved (owner, 2026-07-11 — "si demosle")
> **Created:** 2026-07-11
> **Talla:** M (7-8 archivos de producción, sin migración, extiende 1 servicio UI)

---

## 1. Resumen ejecutivo

Se canoniza en `_bento-grid.scss` el "modo dual": las celdas fill-screen solo reciben `contain: size` / `min-height: 0` dentro de la container query `layoutmain ≥ 1024px` (nueva clase de celda `.bento-fill`), eliminando todos los estilos inline de layout. En móvil/tablet las celdas recuperan altura natural → scroll de página nativo sin cambios por página. Para la densidad se agrega un tier de layout (`mobile|tablet|desktop`) derivado del ancho real de `<main>` vía ResizeObserver en `LayoutService`, y cada página define su presupuesto de items. Orden grueso: utils puros → servicio → shell → SCSS → dashboard → alumnos → QA.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/core/utils/layout-tier.utils.ts` | Util puro | `widthToTier(width: number \| null): LayoutTier` (null→'desktop' SSR-safe; <640→mobile; <1024→tablet; resto→desktop — breakpoints espejo de `$bp-sm`/`$bp-lg` del bento) + `sliceByBudget<T>(items: T[], budget: number \| null): T[]` |
| `src/app/core/utils/layout-tier.utils.spec.ts` | Test | TDD del mapping y slicing (bordes 639/640/1023/1024, budget null, budget > length) |
| `src/app/core/models/ui/layout.model.ts` | UI Model | `export type LayoutTier = 'mobile' \| 'tablet' \| 'desktop'` |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/services/ui/layout.service.ts` | + `_mainWidth` signal, `readonly mainWidth`, `readonly tier = computed(widthToTier)`, `observeMain(el): () => void` (ResizeObserver con guard SSR, retorna cleanup) | Fuente única del tier por CONTENEDOR (decisión spec §9): drawer abierto angosta `main` → tier baja sin tocar el viewport |
| `src/app/core/services/ui/layout.service.spec.ts` | + tests de tier default y actualización de width | testing-tdd (services obligatorio) |
| `src/app/layout/app-shell.component.ts` | `viewChild` del `<main>` + `afterNextRender(() => observeMain(...))` + cleanup en `DestroyRef` | Registrar el observer una sola vez en el shell |
| `src/styles/layout/_bento-grid.scss` | (a) nueva clase de celda `.bento-fill`: dentro de `@container layoutmain (min-width: $bp-lg)` y solo bajo `.bento-grid--fill-screen/-2` aplica `contain: size; min-height: 0;` — fuera de ahí, nada (altura natural). (b) `.bento-card { min-height: 0; min-width: 0 }` → scopear el `min-height: 0` a la misma container query lg (AC9, vía la opción "scoped": evita reordenar `@layer` globales). (c) documentar en `_bento-grid.README.md` | El canon del modo dual vive en el DS, no inline (AC8). El `contain` NO va en `> *` para no colapsar el hero (fila `auto`) |
| `src/app/features/dashboard/dashboard.component.ts` | Quitar `style="contain: size;"` y `min-h-[300px]`/`min-h-[250px]`/clase `dashboard-panel`+CQ local; añadir `.bento-fill` a las 3 celdas; `visibleActivities`/`visibleAlerts = computed(sliceByBudget(x, tier()==='desktop' ? null : 3))`; skeletons acotados al presupuesto | AC1, AC3, AC4, AC-E3. Los botones "Ver toda la actividad"/"Ver todas las alertas" ya existen (drawers) — se mantienen |
| `src/app/shared/components/live-classes-panel/live-classes-panel.component.ts` | Quitar `min-h-[450px]` + `style="contain: size"` + CQ local del host; + input `maxItems = input<number \| null>(null)`; `visibleClasses`/`skeletonItems` computed desde `maxItems` | Sigue siendo Dumb (recibe el presupuesto por input; el dashboard lo calcula con el tier: `null` desktop / `4` resto). AC4, AC-E3 |
| `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` | (a) grid raíz → `bento-grid bento-grid--fill-screen`; card dual-viewport → `.bento-fill`, sin `contain: size; min-height: 600px` inline. (b) filtros `searchTerm/selectedCurso/selectedEstado/selectedExpediente` → signals (`[ngModel]` + `(ngModelChange)`), `filteredAlumnos` → `computed`. (c) vista tarjetas: `mobileShown = signal(6)`, `visibleCards = computed(sliceByBudget(filtered, mobileShown()))`, botón "Cargar más (N restantes)" (+6), reset de `mobileShown` al cambiar filtros | AC2, AC5, AC6. El slicing aplica SOLO al `@for` de tarjetas (`.show-on-squeeze`) — la tabla sigue paginando de a 10 y no depende del tier, evitando desync con el umbral CSS de 900px |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|
| — | Ninguno |

(+ sincronizar `indices/SERVICES.md`, `indices/UTILS.md`, `indices/MODELS.md`, `indices/STYLES.md`, `indices/COMPONENTS.md` al cierre.)

---

## 3. Reutilización (Discovery)

### Componentes/patrones existentes que reutilizamos
- `bento-grid--fill-screen` / `--fill-screen-2` — ya definen el alto y las filas en lg; solo se les cuelga el nuevo `.bento-fill`.
- Drawers existentes (`RecentActivityDrawerComponent`, `AlertsDrawerComponent`, agenda) — destino de los "Ver todas"; cero UI nueva.
- `app-empty-state`, `app-skeleton-block` — estados especiales sin cambios.
- Patrón dual-viewport (container query `listContainer` 900px) de `alumnos-list-content` — se conserva tal cual.
- `btn-ghost` para "Cargar más" (mismo estilo que los "Ver toda la actividad" actuales).

### Facades/Services existentes que extendemos
- `LayoutService` (`core/services/ui/`) — hoy solo maneja `sidebarOpen`; gana `mainWidth`/`tier`/`observeMain()`. Whitelist ARCH-02 permite inyectar `core/services/ui/*` en componentes.

### Qué NO existe y debemos crear (justificación)
- `layout-tier.utils` — no hay ningún signal/servicio de breakpoint en el proyecto (solo `window.innerWidth` ad-hoc dentro de `GsapAnimationsService`, viewport-based e inaccesible). Functional Core puro por regla de arquitectura.

---

## 4. Modelo de datos

N/A — feature 100% presentación. Sin migraciones, sin RLS. Único tipo nuevo: `LayoutTier` en `core/models/ui/layout.model.ts`.

---

## 5. Arquitectura del feature

```
AppShellComponent (layout/)
  └─ afterNextRender: LayoutService.observeMain(<main>)   ← ResizeObserver
       LayoutService.tier: computed('mobile'|'tablet'|'desktop')   [widthToTier]
            │
  DashboardComponent (Smart) ──── inject(LayoutService)
    ├─ liveClassesBudget = computed(tier()==='desktop' ? null : 4)
    ├─ visibleActivities/visibleAlerts = sliceByBudget(…, 3)
    └─ <app-live-classes-panel [maxItems]="liveClassesBudget()">   (Dumb: solo input)

  AlumnosListContentComponent (shared, content-component)
    ├─ filtros → signals → filteredAlumnos: computed (opera sobre el TOTAL)
    ├─ tabla desktop: filteredAlumnos() + paginator 10 (sin cambios)
    └─ tarjetas: visibleCards = sliceByBudget(filteredAlumnos(), mobileShown())
                 botón "Cargar más (N restantes)" → mobileShown += 6

CSS (fuente única _bento-grid.scss):
  @container layoutmain (≥1024px):
    .bento-grid--fill-screen(-2) { height: calc(100vh-120px); rows fijas }
    .bento-grid--fill-screen(-2) > .bento-fill { contain: size; min-height: 0 }
  < 1024px: celdas con altura natural → scroll nativo en .shell-content
```

### Capas tocadas
- **Smart**: `features/dashboard/dashboard.component.ts`
- **Dumb/shared**: `shared/components/live-classes-panel/`, `shared/components/alumnos-list-content/`
- **Service**: `core/services/ui/layout.service.ts`
- **Utils**: `core/utils/layout-tier.utils.ts`
- **Layout shell**: `layout/app-shell.component.ts`
- **DS**: `styles/layout/_bento-grid.scss` (+ README)

---

## 6. Restricciones aplicables

- [x] `architecture.md` — OnPush, Signals, Functional Core (widthToTier/sliceByBudget puros)
- [ ] `facades.md` — no se tocan facades de dominio
- [x] `models.md` — `LayoutTier` en `core/models/ui/`
- [x] `visual-system.md` — canon bento en SCSS del DS, cero estilos inline de layout, `btn-ghost`
- [ ] `swr-pattern.md` — no cambia fetching
- [ ] `notifications.md` — no aplica
- [x] `testing-tdd.md` — specs para `layout-tier.utils` y `LayoutService` (componentes: excluidos de vitest por config → se validan con `ng build` + /verify)
- [x] `ai-readability.md` — `data-llm-action="load-more-students"` en "Cargar más"

---

## 7. Plan de testing

- **Unitarios (TDD, primero):** `layout-tier.utils.spec.ts` (bordes 639/640/1023/1024, null SSR, budget null/0/>length); `layout.service.spec.ts` (tier default desktop, reacción a width, cleanup del observer).
- **Suite completa:** `npm run test:ci` (exigir 100% verde — semáforo actual en verde) + `npm run lint:arch`.
- **QA visual (/verify, Playwright):** para AMBAS páginas y en modo claro/oscuro:
  - 1440×900: `.shell-content` sin scroll (AC1/AC2), tabla llenando el alto.
  - 390×844: sin `contain: size` computado, sin scroll interno en `<ul>`, presupuestos 4/3/3 y 6+Cargar más (AC3-AC5), scroll de página hasta el último item.
  - Drawer abierto en 1440: densidad compacta reactiva (AC7).
  - Consola: Zero Error Policy.
- **Regresión visual spot-check:** 2-3 páginas bento NO migradas (agenda, flota) para confirmar que el cambio de `.bento-card { min-height }` scoped no las altera.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Scopear `min-height: 0` de `.bento-card` altera otras páginas que dependían (sin saberlo) de que las utilities `min-h-*` estuvieran muertas | Media | Opción "scoped" en vez de reordenar `@layer` globales (cambio mínimo); grep de `min-h-\[` en templates con `.bento-card` antes de tocar; spot-check visual de páginas no migradas |
| `p-table` con `scrollHeight="flex"` dentro de `.bento-fill` (alumnos ahora fill-screen real) se comporta distinto que en la caja fija de 600px | Media | Mismo mecanismo ya probado en los paneles del dashboard; verificar paginador y sticky header en /verify |
| Refactor de filtros a signals introduce regresión en la búsqueda/filtrado | Media | Lógica de predicados se copia idéntica dentro del `computed`; QA manual de los 4 filtros + export (usa los mismos valores) |
| Con drawer abierto (force-compact) el dashboard ahora crece en alto y scrollea (antes quedaba colapsado) | Baja | Es el comportamiento deseado (AC7); confirmar con el owner en el /verify |
| ResizeObserver dispara ráfagas de updates en el resize animado del drawer (GSAP) | Baja | El signal solo cambia el tier en los cruces de umbral; computed hace dedupe natural. Si se ve jank, throttle con `requestAnimationFrame` |

---

## 9. Orden de implementación

1. `layout.model.ts` + `layout-tier.utils.ts` con su `.spec.ts` (TDD) → `npm run test:ci`
2. `LayoutService` (tier + observeMain) + spec
3. `app-shell.component.ts` — wiring del observer
4. `_bento-grid.scss` — `.bento-fill` + scoping de `min-height` + README
5. Dashboard: `dashboard.component.ts` + `live-classes-panel` (quitar inline styles, presupuestos, skeletons)
6. Alumnos: `alumnos-list-content.component.ts` (fill-screen, filtros→signals, Cargar más)
7. `npm run lint:arch` + `npm run test:ci` + `/verify` (protocolo §7)
8. Sincronizar `indices/*.md` + `/spec-verify`

---

## 10. Estimación

M — 1 a 2 días. El grueso del riesgo está en los pasos 4 y 6 (CSS del DS y refactor de filtros).

---

## Changelog

- 2026-07-11 — plan inicial (agente, tras discovery de STYLES/SERVICES/DIRECTIVES + diagnóstico Playwright de la spec)
