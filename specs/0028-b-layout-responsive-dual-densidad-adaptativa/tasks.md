# Tasks 0028-b — Layout responsive dual: fill-screen desktop / scroll natural móvil + densidad adaptativa

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-07-11

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Modelo y Functional Core

- [x] **T1.1** — Crear `core/models/ui/layout.model.ts` con `LayoutTier`
  - **DoD:**
    - [x] `export type LayoutTier = 'mobile' | 'tablet' | 'desktop'`
    - [x] Documentado en `indices/MODELS.md` (en Fase 6)

- [x] **T1.2** — Escribir `core/utils/layout-tier.utils.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC4, AC5, AC-E2
  - **DoD:**
    - [x] `widthToTier`: casos 0, 639→mobile; 640, 1023→tablet; 1024, 1440→desktop; `null`→desktop (SSR-safe)
    - [x] `sliceByBudget`: budget `null`→todo; budget ≥ length→todo; budget < length→corte; budget 0→[]; lista vacía→[]
    - [x] Tests FALLAN (no hay implementación aún)

- [x] **T1.3** — Implementar `core/utils/layout-tier.utils.ts`
  - **AC ref:** AC4, AC5, AC-E2
  - **DoD:**
    - [x] Funciones puras sin dependencias Angular
    - [x] Umbrales 640/1024 espejo de `$bp-sm`/`$bp-lg` (comentario que lo diga)
    - [x] Tests PASAN (`npm run test:ci`)

---

## Fase 2 — LayoutService (tier por contenedor)

- [x] **T2.1** — Extender `core/services/ui/layout.service.spec.ts` (TDD)
  - **AC ref:** AC7, AC-E4
  - **DoD:**
    - [x] Test: `tier()` default `'desktop'` antes de observar
    - [x] Test: actualización de width recalcula `tier()` (1440→desktop, 800→tablet, 390→mobile)
    - [x] Test: el cleanup retornado por `observeMain()` desconecta el observer
    - [x] Tests FALLAN

- [x] **T2.2** — Implementar `mainWidth`/`tier`/`observeMain()` en `LayoutService`
  - **AC ref:** AC7, AC-E4
  - **DoD:**
    - [x] `_mainWidth` privado + `mainWidth`/`tier` readonly (patrón signals del proyecto)
    - [x] `observeMain(el)` con guard `typeof ResizeObserver === 'undefined'` y retorno de cleanup
    - [x] Tests PASAN (`npm run test:ci`)
    - [x] Documentado en `indices/SERVICES.md` (en Fase 6)

- [x] **T2.3** — Wire-up en `layout/app-shell.component.ts`
  - **AC ref:** AC7
  - **DoD:**
    - [x] `viewChild` del `<main>` + `afterNextRender` llama `observeMain()`
    - [x] Cleanup registrado en `DestroyRef.onDestroy`
    - [x] `ng build` limpio (componentes no van a vitest)

---

## Fase 3 — Canon CSS del modo dual

- [x] **T3.1** — `.bento-fill` en `src/styles/layout/_bento-grid.scss`
  - **AC ref:** AC3, AC8
  - **DoD:**
    - [x] `contain: size; min-height: 0;` SOLO bajo `@container layoutmain (min-width: $bp-lg)` y SOLO como hijo de `.bento-grid--fill-screen`/`--fill-screen-2`
    - [x] Fuera de esa query la clase no emite nada (altura natural en móvil/tablet)
    - [x] NO se aplica vía `> *` (el hero de fila `auto` no debe recibir `contain`)

- [x] **T3.2** — Scopear `min-height: 0` de `.bento-card` (fix de capas)
  - **AC ref:** AC9
  - **DoD:**
    - [x] `min-height: 0` movido a la misma container query lg (opción "scoped" del plan; NO reordenar `@layer` globales)
    - [x] `grep` de `min-h-\[` en templates con `.bento-card` ejecutado y revisado antes del cambio
    - [x] `_bento-grid.README.md` documenta el modo dual y la trampa de capas

---

## Fase 4 — Migración de páginas de referencia

- [x] **T4.1** — Dashboard: `features/dashboard/dashboard.component.ts`
  - **AC ref:** AC1, AC3, AC4, AC-E1, AC-E3
  - **DoD:**
    - [x] Sin `style="contain: size;"` ni `min-h-[300px]`/`min-h-[250px]` ni CQ local `dashboard-panel`
    - [x] `.bento-fill` en las 3 celdas de paneles
    - [x] `visibleActivities`/`visibleAlerts = computed(sliceByBudget(…, tier()==='desktop' ? null : 3))`
    - [x] Skeletons acotados al presupuesto del tier
    - [x] Botones "Ver toda la actividad"/"Ver todas las alertas" intactos
    - [x] `ng build` limpio

- [x] **T4.2** — `shared/components/live-classes-panel/live-classes-panel.component.ts`
  - **AC ref:** AC3, AC4, AC-E1, AC-E3
  - **DoD:**
    - [x] Host sin `min-h-[450px]` ni `style="contain: size"` ni CQ local
    - [x] Input `maxItems = input<number | null>(null)`; `visibleClasses` y `skeletonItems` computed
    - [x] Sigue Dumb: cero inyección de servicios nuevos (el presupuesto llega por input desde el dashboard)
    - [x] Dashboard le pasa `[maxItems]="tier()==='desktop' ? null : 4"` (computed)
    - [x] Footer "Ver toda la agenda" intacto
    - [x] `ng build` limpio

- [x] **T4.3** — Alumnos fill-screen: `shared/components/alumnos-list-content/alumnos-list-content.component.ts` (parte A)
  - **AC ref:** AC2, AC3
  - **DoD:**
    - [x] Grid raíz con `bento-grid--fill-screen`; card dual-viewport con `.bento-fill`
    - [x] Sin `style="contain: size; min-height: 600px;"` inline
    - [x] Tabla `p-table` con `scrollHeight="flex"` funcional en el alto nuevo (paginador visible)
    - [x] `ng build` limpio

- [x] **T4.4** — Alumnos filtros→signals + "Cargar más" (parte B)
  - **AC ref:** AC5, AC6, AC-E1, AC-E2
  - **DoD:**
    - [x] `searchTerm/selectedCurso/selectedEstado/selectedExpediente` como signals (`[ngModel]` + `(ngModelChange)`); predicados idénticos dentro de `filteredAlumnos` computed
    - [x] `mobileShown = signal(6)`; `visibleCards = sliceByBudget(filteredAlumnos(), mobileShown())` SOLO en el `@for` de tarjetas
    - [x] Botón "Cargar más (N restantes)" con `btn-ghost` + `data-llm-action="load-more-students"`; suma +6; oculto si N=0
    - [x] Cambio de cualquier filtro resetea `mobileShown` a 6
    - [x] Export sigue usando los mismos valores de filtro
    - [x] `ng build` limpio

---

## Fase 5 — Validación

- [x] **T5.1** — `npm run lint:arch` corre limpio
- [x] **T5.2** — `npm run test:ci` corre verde (1209+ tests, incluye los nuevos)
- [x] **T5.3** — `/verify` (Playwright) — protocolo del plan §7
  - **AC ref:** AC1-AC7, AC-E1-E4
  - **DoD:**
    - [x] 1440×900 ambas páginas: `.shell-content` sin scroll; consola limpia; claro/oscuro
    - [x] 390×844 ambas páginas: sin `contain: size` computado; sin scroll interno en `<ul>`; presupuestos 4/3/3 y 6+Cargar más; scroll hasta el último item
    - [x] Drawer abierto en 1440: densidad compacta reactiva sin reload
    - [x] Spot-check de 2 páginas bento NO migradas (agenda, flota) sin regresión visual
- [x] **T5.4** — Ejecutar `/spec-verify`
  - **DoD:** `acceptance.md` con evidencia por AC; AC Verifier en verde

---

## Fase 6 — Cierre

- [x] **T6.1** — Actualizar `indices/` (SERVICES, UTILS, MODELS, STYLES, COMPONENTS, USAGE-MAP vía `npm run indices:sync` + ediciones manuales)
- [x] **T6.2** — Marcar spec como `done` en `ROADMAP.md` (mover de Backlog a Done)
- [x] **T6.3** — Limpiar `specs/.active` (`/spec-activate --clear`)

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
